import Link from "next/link";
import { NavLink } from "./NavLink";
import { Icon } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1.5 py-1">
      <span
        className="grid place-items-center rounded-[10px]"
        style={{
          width: 34,
          height: 34,
          background: "linear-gradient(160deg, var(--accent), var(--accent-2))",
          color: "var(--accent-ink)",
          boxShadow: "0 4px 14px -4px rgba(56,189,248,0.5)",
        }}
      >
        <Icon name="shield" size={19} strokeWidth={2.4} />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">
          Sentinel UEBA
        </span>
        <span className="block kicker" style={{ letterSpacing: "0.12em" }}>
          SOC Platform
        </span>
      </span>
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "SU";
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
        className="w-[248px] shrink-0 hidden md:flex flex-col p-3.5 border-r sticky top-0 h-screen"
        style={{ background: "var(--surface-1)" }}
      >
        <Brand />

        <div className="mt-5 mb-2 px-2 kicker">Operaciones</div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="soc-card-2 p-3 flex items-center gap-3">
            <span
              className="grid place-items-center rounded-full shrink-0 text-xs font-semibold"
              style={{
                width: 34,
                height: 34,
                background: "rgba(56,189,248,0.14)",
                color: "var(--accent)",
                border: "1px solid rgba(56,189,248,0.28)",
              }}
            >
              {initials(userName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div
                className="text-[11px] truncate"
                style={{ color: "var(--fg-muted)" }}
              >
                {roleLabel}
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                className="grid place-items-center rounded-lg p-1.5 transition-colors soc-hover"
                style={{
                  color: "var(--fg-muted)",
                  border: "1px solid var(--border)",
                }}
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <Icon name="logout" size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 md:px-8 h-14 border-b backdrop-blur"
          style={{ background: "rgba(8,11,18,0.72)" }}
        >
          <div className="flex items-center gap-2 md:hidden">
            <Icon name="shield" size={18} style={{ color: "var(--accent)" }} />
            <span className="text-sm font-semibold">Sentinel UEBA</span>
          </div>
          <div
            className="hidden md:flex items-center gap-2 text-sm"
            style={{ color: "var(--fg-muted)" }}
          >
            <Icon name="org" size={15} />
            <span>{orgName ?? "Organización"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-low">
              <span
                className="badge-dot"
                style={{ background: "var(--risk-low)" }}
              />
              Operativo
            </span>
            <form action="/auth/signout" method="post" className="md:hidden">
              <button
                className="btn btn-ghost text-xs py-1.5 px-3"
                type="submit"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="p-5 md:p-8 max-w-[1320px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
