import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
  orgName: string | null;
}

/**
 * Devuelve el contexto de sesión (usuario + perfil + organización) o
 * redirige a /login si no hay sesión. Para uso en Server Components.
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  let orgName: string | null = null;
  if (profile.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single();
    orgName = org?.name ?? null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
    orgName,
  };
}

/** Igual que requireSession pero exige rol interno (analyst|admin). */
export async function requireAnalyst(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role === "client") redirect("/portal");
  return ctx;
}

/** Exige rol cliente. */
export async function requireClient(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "client") redirect("/console");
  return ctx;
}
