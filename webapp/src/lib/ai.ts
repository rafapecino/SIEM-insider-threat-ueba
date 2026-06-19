// Asistente de investigación con IA (gratis) — agnóstico de proveedor.
// Soporta Groq (Llama 3.3, recomendado, sin tarjeta) o Google Gemini Flash.
// Solo server-side: las claves nunca llegan al navegador. Se usa REST (sin SDK).

import type { Alert, AlertReason, Evidence } from "@/lib/types";
import { scenarioName } from "@/lib/constants";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/** Proveedor activo según la clave disponible (Groq tiene prioridad). */
function provider(): "groq" | "gemini" | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function aiEnabled(): boolean {
  return provider() !== null;
}

/** Nombre legible del proveedor/modelo activo (para etiquetar el informe). */
export function providerLabel(): string {
  const p = provider();
  if (p === "groq") return "Groq · Llama 3.3 70B";
  if (p === "gemini") return "Google Gemini Flash";
  return "IA";
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
      `- (Solo demo) ground truth: ${
        alert.is_insider
          ? `amenaza real — ${scenarioName(alert.scenario)}`
          : "no es insider"
      }`,
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

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok)
    throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq devolvió una respuesta vacía");
  return text.trim();
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
    }),
  });
  if (!res.ok)
    throw new Error(
      `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini devolvió una respuesta vacía");
  return text.trim();
}

/** Genera el informe de investigación en markdown. Lanza Error si falla. */
export async function generateInvestigation(
  ctx: InvestigationContext,
): Promise<string> {
  const p = provider();
  if (!p)
    throw new Error("IA no configurada (define GROQ_API_KEY o GEMINI_API_KEY)");
  const prompt = buildPrompt(ctx);
  return p === "groq" ? callGroq(prompt) : callGemini(prompt);
}
