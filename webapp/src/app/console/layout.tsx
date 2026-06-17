import { requireAnalyst } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAnalyst();
  const isAdmin = ctx.profile.role === "admin";

  const nav: NavItem[] = [
    { href: "/console", label: "Resumen", icon: "📊" },
    { href: "/console/alerts", label: "Cola de alertas", icon: "🚨" },
    { href: "/console/analytics", label: "Analítica", icon: "📈" },
  ];
  if (isAdmin) {
    nav.push({ href: "/console/audit", label: "Auditoría", icon: "🧾" });
  }

  return (
    <AppShell
      nav={nav}
      userName={ctx.profile.full_name || "SOC Analyst"}
      roleLabel={isAdmin ? "Administrador SOC" : "Analista SOC"}
      orgName={ctx.orgName}
    >
      {children}
    </AppShell>
  );
}
