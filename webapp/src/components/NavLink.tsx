"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
      style={{
        background: active ? "rgba(56,189,248,0.12)" : "transparent",
        color: active ? "var(--accent)" : "var(--fg-muted)",
        fontWeight: active ? 600 : 500,
      }}
    >
      <span className="text-base">{icon}</span>
      {children}
    </Link>
  );
}
