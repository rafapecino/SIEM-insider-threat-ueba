import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión Supabase en cada request y protege las rutas por rol.
 * - Sin sesión → /login (salvo rutas públicas).
 * - /console/* requiere rol analyst|admin.
 * - /portal/*  requiere rol client.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" || path === "/" || path.startsWith("/auth");

  // Sin sesión: solo rutas públicas.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Rol del usuario (de la tabla profiles).
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role ?? "client";

    const home = role === "client" ? "/portal" : "/console";

    // Ya autenticado y en login/raíz → a su home.
    if (path === "/login" || path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = home;
      return NextResponse.redirect(url);
    }
    // Cliente intentando entrar a la consola, o viceversa.
    if (path.startsWith("/console") && role === "client") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }
    if (path.startsWith("/portal") && role !== "client") {
      const url = request.nextUrl.clone();
      url.pathname = "/console";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
