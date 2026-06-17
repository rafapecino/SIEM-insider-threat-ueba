import { requireAnalyst } from "@/lib/auth";
import {
  getAlerts,
  getDepartments,
  type AlertFilters as F,
} from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/ui";
import { AlertsTable } from "@/components/AlertsTable";
import { AlertFilters } from "@/components/AlertFilters";

export default async function AlertsQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAnalyst();
  const sp = await searchParams;
  const get = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;

  const filters: F = {
    status: get("status"),
    threat: get("threat"),
    department: get("department"),
    q: get("q"),
    scenario: get("scenario") ? Number(get("scenario")) : undefined,
  };

  const [alerts, departments] = await Promise.all([
    getAlerts(filters),
    getDepartments(),
  ]);

  return (
    <>
      <PageHeader
        title="Cola de alertas"
        subtitle={`${alerts.length} alertas · priorizadas por riesgo unificado multi-detector`}
      />
      <AlertFilters departments={departments} showScenario />
      {alerts.length === 0 ? (
        <EmptyState>
          Ninguna alerta cumple los filtros seleccionados.
        </EmptyState>
      ) : (
        <AlertsTable alerts={alerts} showGroundTruth />
      )}
    </>
  );
}
