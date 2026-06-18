import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnalyst } from "@/lib/auth";
import {
  getAlert,
  getAlertEvents,
  getDailyScores,
  getAnalysts,
  getEvidence,
} from "@/lib/queries";
import { Card } from "@/components/ui";
import {
  RiskBadge,
  StatusBadge,
  ThreatBadge,
  DetectorBadge,
} from "@/components/badges";
import { RiskTimeline } from "@/components/charts/RiskTimeline";
import { ReasonsChart } from "@/components/charts/ReasonsChart";
import { InvestigationPanel } from "./InvestigationPanel";
import { EventThread } from "./EventThread";
import { EvidenceLog } from "./EvidenceLog";
import {
  DETECTOR_SPECIALTY,
  RISK_HIGH,
  fmtDate,
  scenarioName,
} from "@/lib/constants";
import type { AlertReason } from "@/lib/types";

export default async function AlertDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnalyst();
  const { id } = await params;

  const alert = await getAlert(id);
  if (!alert) notFound();

  const [events, daily, analysts, evidence] = await Promise.all([
    getAlertEvents(id),
    getDailyScores(alert.user_cert),
    getAnalysts(),
    getEvidence(alert.user_cert, alert.peak_day),
  ]);

  const points = daily.map((d) => ({
    day: d.day,
    risk: Number(d.risk),
    insider: !!d.is_insider,
  }));
  const reasons = (alert.reasons ?? []) as AlertReason[];

  return (
    <>
      <div className="mb-4">
        <Link href="/console/alerts" className="link text-sm">
          ← Cola de alertas
        </Link>
      </div>

      {/* Cabecera del caso */}
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold font-mono">{alert.user_cert}</h1>
        <RiskBadge risk={Number(alert.risk)} />
        <StatusBadge status={alert.status} />
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--fg-muted)" }}>
        {alert.role_cert || "—"} · {alert.department || "—"} · pico el{" "}
        {fmtDate(alert.peak_day)}
      </p>

      {alert.is_insider && (
        <div className="badge badge-high mb-6 px-4 py-2">
          ⚠️ Modo demostración: este empleado fue una amenaza real (
          {scenarioName(alert.scenario)}).
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Veredicto del motor">
            <div className="flex flex-wrap gap-2 mb-3">
              <DetectorBadge detector={alert.detector} />
              <ThreatBadge threat={alert.threat_type} />
            </div>
            <p className="text-sm leading-relaxed">
              <span className="font-mono font-semibold">{alert.user_cert}</span>{" "}
              alcanzó un riesgo de <b>{Number(alert.risk).toFixed(0)}/100</b> el{" "}
              <b>{fmtDate(alert.peak_day)}</b>, detectado por{" "}
              <b>{alert.detector}</b> —{" "}
              <span style={{ color: "var(--fg-muted)" }}>
                {DETECTOR_SPECIALTY[alert.detector] ??
                  "anomalía de comportamiento"}
              </span>
              . Conducta dominante: <b>{alert.threat_type ?? "—"}</b>.
            </p>
          </Card>

          <Card title="Evolución del riesgo del empleado">
            {points.length > 0 ? (
              <RiskTimeline
                data={points}
                peakDay={alert.peak_day}
                threshold={RISK_HIGH}
              />
            ) : (
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                Sin serie temporal disponible.
              </p>
            )}
          </Card>

          {reasons.length > 0 && (
            <Card title="Su peor día frente a su rutina normal">
              <ReasonsChart reasons={reasons} />
            </Card>
          )}

          <Card
            title={`Registro forense del ${fmtDate(alert.peak_day)} · ${evidence.length} eventos`}
          >
            <p className="text-xs mb-4" style={{ color: "var(--fg-muted)" }}>
              Eventos crudos de los logs (acceso, USB, ficheros, correo) ese
              día, ordenados cronológicamente. La evidencia que sustenta la
              alerta.
            </p>
            <EvidenceLog evidence={evidence} />
          </Card>

          <Card title="Hilo de investigación">
            <EventThread events={events} />
          </Card>
        </div>

        {/* Panel de acciones */}
        <div className="space-y-6">
          <InvestigationPanel alert={alert} analysts={analysts} />
        </div>
      </div>
    </>
  );
}
