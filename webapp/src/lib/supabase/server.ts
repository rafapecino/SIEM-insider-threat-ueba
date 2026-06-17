import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente Supabase para Server Components / Server Actions / Route Handlers.
 * Lee y escribe la sesión en cookies (auth con SSR).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ignorable, el middleware
            // refresca la sesión.
          }
        },
      },
    },
  );
}

/**
 * Cliente con service_role (omite RLS). SOLO para uso en server, nunca
 * expuesto al cliente. Usado para acciones administrativas controladas.
 */
export function createAdminClient() {
  const { createClient: createSb } = require("@supabase/supabase-js");
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
