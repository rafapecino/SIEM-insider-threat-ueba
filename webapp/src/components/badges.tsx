import type { AlertStatus } from "@/lib/types";
import { riskBand, RISK_BAND_LABEL, STATUS_LABEL } from "@/lib/constants";

export function RiskBadge({ risk }: { risk: number }) {
  const band = riskBand(risk);
  const dot = band === "high" ? "🔴" : band === "med" ? "🟠" : "🟢";
  return (
    <span className={`badge badge-${band}`}>
      {dot} {risk.toFixed(0)} · {RISK_BAND_LABEL[band]}
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
  return <span className="badge badge-neutral">🔬 {detector}</span>;
}
