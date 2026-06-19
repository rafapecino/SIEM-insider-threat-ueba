import { requireAnalyst } from "@/lib/auth";
import { getAlerts, getSummary } from "@/lib/queries";
import { PageHeader, Kpi, Card } from "@/components/ui";
import { BarBreakdown } from "@/components/charts/BarBreakdown";

function countBy<T extends string>(
  items: (T | null)[],
): { name: string; value: number }[] {
  const m = new Map<string, number>();
  items.forEach((it) => {
    const k = it ?? "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export default async function AnalyticsPage() {
  await requireAnalyst();
  const [alerts, kpis] = await Promise.all([getAlerts({}), getSummary(true)]);

  const byDetector = countBy(alerts.map((a) => a.detector));
  const byThreat = countBy(alerts.map((a) => a.threat_type));

  // Distribución de riesgo por banda.
  const bands = [
    {
      name: "Bajo (<75)",
      value: alerts.filter((a) => a.risk < 75).length,
      color: "#22c55e",
    },
    {
      name: "Medio (75-90)",
      value: alerts.filter((a) => a.risk >= 75 && a.risk < 90).length,
      color: "#f59e0b",
    },
    {
      name: "Alto (≥90)",
      value: alerts.filter((a) => a.risk >= 90).length,
      color: "#f43f5e",
    },
  ];

  const detected = kpis.detected ?? 0;

  return (
    <>
      <PageHeader
        kicker="Inteligencia"
        title="Analítica del SOC"
        subtitle="Composición de la cola de alertas y rendimiento de detección"
        icon="analytics"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi
          label="Alertas totales"
          value={kpis.total}
          tone="accent"
          icon="alerts"
        />
        <Kpi
          label="Riesgo alto"
          value={kpis.high}
          tone="high"
          sub="score ≥ 90"
          icon="activity"
        />
        <Kpi
          label="Amenazas reales captadas"
          value={detected}
          tone="low"
          sub="insiders en la cola (demo)"
          icon="check"
        />
        <Kpi
          label="Cerradas"
          value={kpis.closed}
          sub="resueltas / FP"
          icon="ack"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Alertas por detector responsable">
          <BarBreakdown data={byDetector} />
        </Card>
        <Card title="Alertas por tipo de amenaza">
          <BarBreakdown data={byThreat} color="#a78bfa" />
        </Card>
      </div>

      <Card title="Distribución por banda de riesgo">
        <BarBreakdown data={bands} height={220} />
        <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
          El motor combina 4 detectores especializados (Reglas, Isolation
          Forest, Autoencoder y Transformer temporal): cada alerta se atribuye
          al especialista que la marcó como más anómala. Ningún detector gana en
          todos los escenarios; la unión cubre más amenazas que cualquiera por
          separado.
        </p>
      </Card>
    </>
  );
}
