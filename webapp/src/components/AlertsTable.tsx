import Link from "next/link";
import type { Alert } from "@/lib/types";
import { RiskBadge, StatusBadge, ThreatBadge } from "@/components/badges";
import { fmtDate, scenarioName, riskBand } from "@/lib/constants";

const BAR: Record<string, string> = {
  high: "var(--risk-high)",
  med: "var(--risk-med)",
  low: "var(--risk-low)",
};

export function AlertsTable({
  alerts,
  showGroundTruth = false,
  linkBase = "/console/alerts",
}: {
  alerts: Alert[];
  showGroundTruth?: boolean;
  linkBase?: string | null;
}) {
  return (
    <div className="soc-card overflow-x-auto w-full max-w-full">
      <table className="soc-table">
        <thead>
          <tr>
            <th style={{ paddingLeft: 0 }}></th>
            <th>Empleado</th>
            <th>Riesgo</th>
            <th>Detectado por</th>
            <th>Tipo de amenaza</th>
            <th>Departamento</th>
            <th>Día pico</th>
            <th>Estado</th>
            <th>Asignado</th>
            {showGroundTruth && <th>Ground truth</th>}
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => {
            const band = riskBand(Number(a.risk));
            const initials = a.user_cert.slice(0, 2).toUpperCase();
            return (
              <tr key={a.id}>
                {/* barra de severidad */}
                <td style={{ width: 4, padding: 0 }}>
                  <span
                    style={{
                      display: "block",
                      width: 4,
                      height: 40,
                      borderRadius: 4,
                      background: BAR[band],
                      boxShadow: `0 0 10px -1px ${BAR[band]}`,
                    }}
                  />
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <span
                      className="grid place-items-center rounded-lg shrink-0 text-[11px] font-semibold font-mono"
                      style={{
                        width: 32,
                        height: 32,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      {initials}
                    </span>
                    {linkBase ? (
                      <Link
                        href={`${linkBase}/${a.id}`}
                        className="link font-mono font-semibold"
                      >
                        {a.user_cert}
                      </Link>
                    ) : (
                      <span className="font-mono font-semibold">
                        {a.user_cert}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <RiskBadge risk={Number(a.risk)} />
                </td>
                <td
                  className="whitespace-nowrap"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {a.detector}
                </td>
                <td>
                  <ThreatBadge threat={a.threat_type} />
                </td>
                <td style={{ color: "var(--fg-muted)" }}>
                  {a.department || "—"}
                </td>
                <td style={{ color: "var(--fg-muted)" }}>
                  {fmtDate(a.peak_day)}
                </td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td style={{ color: "var(--fg-muted)" }}>
                  {a.assignee?.full_name || "—"}
                </td>
                {showGroundTruth && (
                  <td>
                    {a.is_insider ? (
                      <span
                        className="badge badge-high max-w-[140px] md:max-w-[180px] min-w-0"
                        title={scenarioName(a.scenario)}
                      >
                        <span
                          className="badge-dot shrink-0"
                          style={{ background: "var(--risk-high)" }}
                        />
                        <span className="truncate">
                          {scenarioName(a.scenario)}
                        </span>
                      </span>
                    ) : (
                      <span className="badge badge-neutral">
                        <span
                          className="badge-dot"
                          style={{ background: "var(--fg-faint)" }}
                        />
                        No
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
