import Link from "next/link";
import { NavLink } from "./NavLink";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function AppShell({
  nav,
  userName,
  roleLabel,
  orgName,
  children,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  orgName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 hidden md:flex flex-col p-4 border-r"
        style={{ background: "var(--bg-elev)" }}
      >
        <Link href="/" className="flex items-center gap-3 px-2 py-2">
          <span className="text-2xl">🛡️</span>
          <span>
            <span className="block text-sm font-bold leading-tight">
              Sentinel UEBA
            </span>
            <span
              className="block text-[11px]"
              style={{ color: "var(--fg-muted)" }}
            >
              SOC Platform
            </span>
          </span>
        </Link>

        <nav className="mt-6 flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto soc-card p-3">
          <div className="text-sm font-semibold truncate">{userName}</div>
          <div className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
            {roleLabel}
            {orgName ? ` · ${orgName}` : ""}
          </div>
          <form action="/auth/signout" method="post" className="mt-3">
            <button className="btn btn-ghost w-full text-xs py-2" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        {/* Topbar móvil */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b"
          style={{ background: "var(--bg-elev)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <span className="text-sm font-bold">Sentinel UEBA</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn btn-ghost text-xs py-1.5 px-3" type="submit">
              Salir
            </button>
          </form>
        </header>

        <main className="p-5 md:p-8 max-w-[1280px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
