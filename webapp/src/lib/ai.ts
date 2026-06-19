// Asistente de investigación con IA (gratis) — Google Gemini Flash.
// Solo server-side: la clave (GEMINI_API_KEY) nunca llega al navegador.
// Se usa vía REST (sin SDK) para no añadir dependencias.

import type { Alert, AlertReason, Evidence } from "@/lib/types";
import { scenarioName } from "@/lib/constants";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export function aiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

const SYSTEM = `Eres un analista senior de un SOC (Security Operations Center) especializado
en amenazas internas (insider threats). Recibes una alerta generada por un motor UEBA y la
evidencia forense del día. Redacta un informe de investigación claro y accionable, en español,
en formato markdown, con EXACTAMENTE estas secciones:

## Triage
- Veredicto probable: (Amenaza real / Falso positivo / Requiere más análisis)
- Confianza: (alta/media/baja) y prioridad sugerida (P1/P2/P3)
- Justificación en 2-3 frases.

## Resumen del caso
Qué hizo el empleado y por qué saltó la alerta (2-4 frases).

## Evidencia clave
Lista con viñetas de los hechos más relevantes (horas, ficheros, USB, correos, accesos).

## Técnica (MITRE ATT&CK)
La táctica/técnica más plausible (p. ej. "Exfiltration over physical medium — T1052").

## Próximos pasos
3-5 acciones concretas para el analista (verificar, contener, escalar, contactar, etc.).

Sé conciso y profesional. No inventes datos que no estén en la evidencia. Si la evidencia es
escasa, dilo y recomienda recopilar más.`;

export interface InvestigationContext {
  alert: Alert;
  reasons: AlertReason[];
  evidence: Evidence[];
}

function buildPrompt({
  alert,
  reasons,
  evidence,
}: InvestigationContext): string {
  const lines: string[] = [];
  lines.push(`# Alerta`);
  lines.push(`- Empleado: ${alert.user_cert}`);
  lines.push(
    `- Rol/Departamento: ${alert.role_cert ?? "—"} / ${alert.department ?? "—"}`,
  );
  lines.push(`- Riesgo: ${Number(alert.risk).toFixed(0)}/100`);
  lines.push(`- Detector responsable: ${alert.detector}`);
  lines.push(`- Tipo de amenaza (heurístico): ${alert.threat_type ?? "—"}`);
  lines.push(`- Día pico: ${alert.peak_day}`);
  if (alert.is_insider != null) {
    lines.push(
      `- (Solo demo) ground truth: ${alert.is_insider ? `amenaza real — ${scenarioName(alert.scenario)}` : "no es insider"}`,
    );
  }

  if (reasons.length) {
    lines.push(`\n# Conductas destacadas (día pico, valor vs media propia)`);
    for (const r of reasons) {
      lines.push(
        `- ${r.label}: ${r.value} (media ${Number(r.avg).toFixed(2)})`,
      );
    }
  }

  lines.push(`\n# Evidencia forense del día (cronológica)`);
  if (evidence.length === 0) {
    lines.push("(sin eventos registrados)");
  } else {
    for (const e of evidence.slice(0, 120)) {
      const t = new Date(e.ts).toISOString().slice(11, 19);
      lines.push(`- ${t} [${e.kind}/${e.severity}] ${e.summary}`);
    }
  }
  return lines.join("\n");
}

/** Llama a Gemini Flash y devuelve el informe en markdown. Lanza Error si falla. */
export async function generateInvestigation(
  ctx: InvestigationContext,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: buildPrompt(ctx) }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini devolvió una respuesta vacía");
  return text.trim();
}
