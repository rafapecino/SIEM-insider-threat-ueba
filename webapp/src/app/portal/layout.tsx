import { requireClient } from "@/lib/auth";
import { AppShell, type NavItem } from "@/components/AppShell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireClient();

  const nav: NavItem[] = [
    { href: "/portal", label: "Mi seguridad", icon: "🛡️" },
  ];

  return (
    <AppShell
      nav={nav}
      userName={ctx.profile.full_name || "Cliente"}
      roleLabel="Cliente"
      orgName={ctx.orgName}
    >
      {children}
    </AppShell>
  );
}
