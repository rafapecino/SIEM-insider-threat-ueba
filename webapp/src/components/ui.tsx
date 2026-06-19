import { Icon } from "./icons";

export function PageHeader({
  title,
  subtitle,
  kicker,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  icon?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {icon && (
            <span
              className="grid place-items-center rounded-xl shrink-0"
              style={{
                width: 44,
                height: 44,
                background: "rgba(34,211,238,0.1)",
                color: "var(--accent)",
                border: "1px solid rgba(34,211,238,0.25)",
              }}
            >
              <Icon name={icon} size={22} />
            </span>
          )}
          <div>
            {kicker && <div className="kicker mb-1">{kicker}</div>}
            <h1 className="h-title">{title}</h1>
            {subtitle && (
              <p
                className="mt-1.5 text-sm"
                style={{ color: "var(--fg-muted)" }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  high: "var(--risk-high)",
  med: "var(--risk-med)",
  low: "var(--risk-low)",
  accent: "var(--accent)",
};

export function Kpi({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "high" | "med" | "low" | "accent";
  icon?: string;
}) {
  const color = tone ? TONE[tone] : "var(--fg)";
  return (
    <div className="stat">
      {tone && <span className="stat-glow" style={{ background: color }} />}
      <div className="relative flex items-start justify-between">
        <div className="kicker">{label}</div>
        {icon && (
          <span
            className="grid place-items-center rounded-lg shrink-0"
            style={{
              width: 30,
              height: 30,
              background: tone
                ? `color-mix(in srgb, ${color} 14%, transparent)`
                : "var(--surface-2)",
              color: tone ? color : "var(--fg-muted)",
              border: "1px solid var(--border)",
            }}
          >
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <div
        className="relative text-[2rem] font-semibold mt-2 tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="relative text-xs mt-1.5"
          style={{ color: "var(--fg-faint)" }}
        >
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
      {title && (
        <h3 className="text-sm font-semibold mb-3.5 relative">{title}</h3>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="soc-card p-12 text-center text-sm"
      style={{ color: "var(--fg-muted)" }}
    >
      {children}
    </div>
  );
}
