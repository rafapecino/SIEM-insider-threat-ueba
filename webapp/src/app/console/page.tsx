import Link from "next/link";
import { requireAnalyst } from "@/lib/auth";
import { getSummary, getAlerts } from "@/lib/queries";
import { PageHeader, Kpi, EmptyState } from "@/components/ui";
import { AlertsTable } from "@/components/AlertsTable";

export default async function ConsoleHome() {
  const ctx = await requireAnalyst();
  const [kpis, topAlerts] = await Promise.all([
    getSummary(true),
    getAlerts({ status: "new" }),
  ]);

  return (
    <>
      <PageHeader
        kicker="Centro de operaciones"
        title="Resumen del SOC"
        subtitle={`Estado operativo · ${ctx.orgName ?? "Organización"}`}
        icon="dashboard"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi
          label="Alertas abiertas"
          value={kpis.open}
          tone="accent"
          sub="sin tomar"
          icon="alerts"
        />
        <Kpi
          label="En investigación"
          value={kpis.investigating}
          tone="med"
          sub="en curso"
          icon="search"
        />
        <Kpi
          label="Escaladas"
          value={kpis.escalated}
          tone="high"
          sub="prioridad alta"
          icon="risk"
        />
        <Kpi
          label="Riesgo alto"
          value={kpis.high}
          tone="high"
          sub="score ≥ 90"
          icon="activity"
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Alertas nuevas por revisar</h2>
        <Link href="/console/alerts" className="link text-sm">
          Ver cola completa →
        </Link>
      </div>

      {topAlerts.length === 0 ? (
        <EmptyState>No hay alertas nuevas pendientes. 🎉</EmptyState>
      ) : (
        <AlertsTable alerts={topAlerts.slice(0, 12)} showGroundTruth />
      )}
    </>
  );
}
