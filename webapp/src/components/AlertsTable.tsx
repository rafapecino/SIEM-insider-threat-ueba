import Link from "next/link";
import type { Alert } from "@/lib/types";
import { RiskBadge, StatusBadge, ThreatBadge } from "@/components/badges";
import { fmtDate, scenarioName } from "@/lib/constants";

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
    <div className="soc-card overflow-x-auto">
      <table className="soc-table">
        <thead>
          <tr>
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
          {alerts.map((a) => (
            <tr key={a.id} className="cursor-pointer">
              <td>
                {linkBase ? (
                  <Link
                    href={`${linkBase}/${a.id}`}
                    className="link font-mono font-semibold"
                  >
                    {a.user_cert}
                  </Link>
                ) : (
                  <span className="font-mono font-semibold">{a.user_cert}</span>
                )}
              </td>
              <td>
                <RiskBadge risk={Number(a.risk)} />
              </td>
              <td className="whitespace-nowrap">{a.detector}</td>
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
                    <span className="badge badge-high">
                      🔴 {scenarioName(a.scenario)}
                    </span>
                  ) : (
                    <span className="badge badge-neutral">⚪ No</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
