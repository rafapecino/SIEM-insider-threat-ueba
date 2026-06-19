"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

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
  const active =
    href === "/console" || href === "/portal"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm transition-colors"
      style={{
        background: active ? "rgba(56,189,248,0.1)" : "transparent",
        color: active ? "var(--accent)" : "var(--fg-muted)",
        fontWeight: active ? 600 : 500,
      }}
    >
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full transition-opacity"
        style={{ background: "var(--accent)", opacity: active ? 1 : 0 }}
      />
      <Icon name={icon} size={17} strokeWidth={active ? 2.4 : 2} />
      <span>{children}</span>
    </Link>
  );
}
