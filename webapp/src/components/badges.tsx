import type { AlertStatus } from "@/lib/types";
import { riskBand, RISK_BAND_LABEL, STATUS_LABEL } from "@/lib/constants";
import { Icon } from "./icons";

const RISK_DOT: Record<string, string> = {
  high: "var(--risk-high)",
  med: "var(--risk-med)",
  low: "var(--risk-low)",
};

export function RiskBadge({ risk }: { risk: number }) {
  const band = riskBand(risk);
  return (
    <span className={`badge badge-${band}`}>
      <span className="badge-dot" style={{ background: RISK_DOT[band] }} />
      {risk.toFixed(0)}
      <span style={{ opacity: 0.6, fontWeight: 500 }}>
        · {RISK_BAND_LABEL[band]}
      </span>
    </span>
  );
}

export function StatusBadge({ status }: { status: AlertStatus }) {
  return (
    <span className={`badge status-${status}`}>{STATUS_LABEL[status]}</span>
  );
}

export function ThreatBadge({ threat }: { threat: string | null }) {
  if (!threat) return <span className="badge badge-neutral">—</span>;
  const normal = threat === "Comportamiento normal";
  return (
    <span className={`badge ${normal ? "badge-neutral" : "badge-accent"}`}>
      {threat}
    </span>
  );
}

export function DetectorBadge({ detector }: { detector: string }) {
  return (
    <span className="badge badge-neutral">
      <Icon name="detector" size={12} />
      {detector}
    </span>
  );
}
