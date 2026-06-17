import { requireClient } from "@/lib/auth";
import { getPortalAlerts, getSummary } from "@/lib/queries";
import { PageHeader, Kpi, Card, EmptyState } from "@/components/ui";
import { AlertsTable } from "@/components/AlertsTable";
import { BarBreakdown } from "@/components/charts/BarBreakdown";

function countBy(items: (string | null)[]): { name: string; value: number }[] {
  const m = new Map<string, number>();
  items.forEach((it) => {
    const k = it ?? "—";
    if (k === "Comportamiento normal") return;
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export default async function PortalHome() {
  const ctx = await requireClient();
  const [alerts, kpis] = await Promise.all([
    getPortalAlerts(),
    getSummary(false),
  ]);

  const byThreat = countBy(alerts.map((a) => a.threat_type));

  return (
    <>
      <PageHeader
        title="Estado de seguridad"
        subtitle={`${ctx.orgName ?? "Su organización"} · supervisado por el SOC de Sentinel UEBA`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi
          label="Alertas abiertas"
          value={kpis.open}
          tone="accent"
          sub="por revisar"
        />
        <Kpi
          label="En investigación"
          value={kpis.investigating}
          tone="med"
          sub="el SOC está revisando"
        />
        <Kpi
          label="Escaladas"
          value={kpis.escalated}
          tone="high"
          sub="requieren atención"
        />
        <Kpi
          label="Resueltas"
          value={kpis.closed}
          tone="low"
          sub="cerradas / descartadas"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card title="Amenazas por tipo" className="lg:col-span-1">
          {byThreat.length ? (
            <BarBreakdown data={byThreat} color="#a78bfa" height={240} />
          ) : (
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Sin actividad sospechosa relevante.
            </p>
          )}
        </Card>

        <Card title="¿Cómo funciona?" className="lg:col-span-2">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--fg-muted)" }}
          >
            El SOC de Sentinel UEBA analiza a diario el comportamiento de su
            plantilla (accesos, USB, correo y ficheros) con un motor de
            detección de anomalías multi-detector. Cuando alguien se desvía de
            su patrón normal, se genera una alerta que un analista revisa,
            investiga y resuelve. Aquí ve el estado agregado y la gestión de
            cada caso, sin datos sensibles del proceso interno de investigación.
          </p>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-3">Alertas de su organización</h2>
      {alerts.length === 0 ? (
        <EmptyState>No hay alertas activas en este momento. 🎉</EmptyState>
      ) : (
        <AlertsTable alerts={alerts} linkBase={null} />
      )}
    </>
  );
}
