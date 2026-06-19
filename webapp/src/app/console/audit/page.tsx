import Link from "next/link";
import { requireAnalyst } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuditLog } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/constants";

export default async function AuditPage() {
  const ctx = await requireAnalyst();
  if (ctx.profile.role !== "admin") redirect("/console");

  const log = await getAuditLog();

  return (
    <>
      <PageHeader
        kicker="Cumplimiento"
        title="Registro de auditoría"
        subtitle="Quién investigó a quién y cuándo (trazabilidad GDPR / ISO 27001)"
        icon="audit"
      />
      {log.length === 0 ? (
        <EmptyState>Aún no hay acciones registradas.</EmptyState>
      ) : (
        <div className="soc-card overflow-x-auto">
          <table className="soc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Acción</th>
                <th>Empleado investigado</th>
                <th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id}>
                  <td style={{ color: "var(--fg-muted)" }}>
                    {fmtDateTime(e.created_at)}
                  </td>
                  <td>{e.actor_profile?.full_name || "—"}</td>
                  <td>
                    <span className="badge badge-neutral font-mono">
                      {e.action}
                    </span>
                  </td>
                  <td className="font-mono">{e.target_user_cert || "—"}</td>
                  <td>
                    {e.target_alert ? (
                      <Link
                        href={`/console/alerts/${e.target_alert}`}
                        className="link"
                      >
                        ver caso
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
