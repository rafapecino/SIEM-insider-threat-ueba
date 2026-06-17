"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Introduce email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciales no válidas. Revisa email y contraseña." };
  }

  // El rol decide el destino; el middleware lo reconducirá si procede.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let dest = "/console";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    dest = profile?.role === "client" ? "/portal" : "/console";
  }
  redirect(dest);
}
