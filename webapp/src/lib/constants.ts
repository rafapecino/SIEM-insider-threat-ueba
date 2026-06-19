import type { AlertStatus } from "./types";

/** Umbrales del semáforo de riesgo (sobre 0-100). */
export const RISK_HIGH = 90;
export const RISK_MED = 75;

export type RiskBand = "high" | "med" | "low";

export function riskBand(risk: number): RiskBand {
  if (risk >= RISK_HIGH) return "high";
  if (risk >= RISK_MED) return "med";
  return "low";
}

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  high: "Alto",
  med: "Medio",
  low: "Bajo",
};

/** Estados de alerta: etiqueta legible + clase CSS. */
export const STATUS_LABEL: Record<AlertStatus, string> = {
  new: "Nueva",
  investigating: "En investigación",
  escalated: "Escalada",
  closed: "Cerrada",
  false_positive: "Falso positivo",
};

export const STATUS_ORDER: AlertStatus[] = [
  "new",
  "investigating",
  "escalated",
  "closed",
  "false_positive",
];

/** Tipos de amenaza (casuística), espejo de dashboard/data.py THREAT_TYPES. */
export const THREAT_TYPES = [
  "Exfiltración por USB",
  "Acceso a PC ajeno",
  "Fuga por email",
  "Actividad fuera de horario",
  "Uso de USB",
  "Comportamiento normal",
];

/** Especialidad de cada detector (texto legible). */
export const DETECTOR_SPECIALTY: Record<string, string> = {
  Reglas: "Accesos fuera de horario y uso de USB (robo directo)",
  "Isolation Forest": "Anomalías generales de comportamiento",
  Autoencoder: "Desviaciones sutiles del patrón normal",
  "Transformer temporal": "Cambios y escaladas en el tiempo",
};

/** Nombre legible de un escenario del ground truth (solo interno/demo). */
export function scenarioName(n: number | null | undefined): string {
  switch (n) {
    case 1:
      return "Esc. 1 · Fuga a Wikileaks";
    case 2:
      return "Esc. 2 · Robo antes de marcharse";
    case 3:
      return "Esc. 3 · Sabotaje de sysadmin";
    default:
      return "—";
  }
}

/** Etiqueta corta de escenario para badges compactos en tablas. */
export function scenarioShort(n: number | null | undefined): string {
  switch (n) {
    case 1:
      return "Esc. 1";
    case 2:
      return "Esc. 2";
    case 3:
      return "Esc. 3";
    default:
      return "—";
  }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
