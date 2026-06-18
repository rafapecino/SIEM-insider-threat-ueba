export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "high" | "med" | "low" | "accent";
}) {
  const color =
    tone === "high"
      ? "var(--risk-high)"
      : tone === "med"
        ? "var(--risk-med)"
        : tone === "low"
          ? "var(--risk-low)"
          : tone === "accent"
            ? "var(--accent)"
            : "var(--fg)";
  return (
    <div className="soc-card p-4 relative overflow-hidden">
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: color, opacity: tone ? 0.9 : 0.25 }}
      />
      <div
        className="text-[11px] uppercase tracking-wide font-medium"
        style={{ color: "var(--fg-muted)" }}
      >
        {label}
      </div>
      <div className="text-3xl font-bold mt-1 tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-0.5" style={{ color: "var(--fg-faint)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`soc-card p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold mb-3">{title}</h3>}
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="soc-card p-10 text-center text-sm"
      style={{ color: "var(--fg-muted)" }}
    >
      {children}
    </div>
  );
}
