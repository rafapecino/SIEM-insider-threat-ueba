"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/lib/constants";
import type { Alert, AlertReason, AlertStatus } from "@/lib/types";
import { getEvidence } from "@/lib/queries";
import { generateInvestigation } from "@/lib/ai";

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function audit(
  action: string,
  alertId: string,
  userCert: string,
): Promise<void> {
  const supabase = await createClient();
  const uid = await currentUserId();
  await supabase.from("audit_log").insert({
    actor: uid,
    action,
    target_alert: alertId,
    target_user_cert: userCert,
  });
}

/** Cambia el estado de una alerta y registra evento + auditoría. */
export async function changeStatus(formData: FormData): Promise<void> {
  const alertId = String(formData.get("alertId"));
  const userCert = String(formData.get("userCert"));
  const status = String(formData.get("status")) as AlertStatus;

  const supabase = await createClient();
  const uid = await currentUserId();

  await supabase
    .from("alerts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", alertId);

  await supabase.from("alert_events").insert({
    alert_id: alertId,
    author: uid,
    kind: "status_change",
    payload: { status },
    note: `Estado cambiado a «${STATUS_LABEL[status] ?? status}».`,
  });

  await audit(`status:${status}`, alertId, userCert);
  revalidatePath(`/console/alerts/${alertId}`);
  revalidatePath("/console/alerts");
}

/** Asigna la alerta a un analista (o "a mí" si assignee vacío = uid actual). */
export async function assignAlert(formData: FormData): Promise<void> {
  const alertId = String(formData.get("alertId"));
  const userCert = String(formData.get("userCert"));
  let assignee = String(formData.get("assignee") || "");

  const supabase = await createClient();
  const uid = await currentUserId();
  if (!assignee) assignee = uid ?? "";

  await supabase
    .from("alerts")
    .update({
      assigned_to: assignee || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  // Nombre legible del asignado para la nota.
  let name = "sin asignar";
  if (assignee) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", assignee)
      .single();
    name = data?.full_name || "analista";
  }

  await supabase.from("alert_events").insert({
    alert_id: alertId,
    author: uid,
    kind: "assignment",
    payload: { assignee },
    note: `Caso asignado a ${name}.`,
  });

  await audit("assign", alertId, userCert);
  revalidatePath(`/console/alerts/${alertId}`);
  revalidatePath("/console/alerts");
}

/** Genera un informe de investigación con IA (Gemini Flash) y lo guarda en el hilo. */
export async function investigateWithAI(formData: FormData): Promise<void> {
  const alertId = String(formData.get("alertId"));
  const userCert = String(formData.get("userCert"));

  const supabase = await createClient();
  const uid = await currentUserId();

  const { data: alert } = await supabase
    .from("alerts")
    .select("*")
    .eq("id", alertId)
    .single();
  if (!alert) return;

  const evidence = await getEvidence(userCert, (alert as Alert).peak_day);

  let report: string;
  try {
    report = await generateInvestigation({
      alert: alert as Alert,
      reasons: ((alert as Alert).reasons ?? []) as AlertReason[],
      evidence,
    });
  } catch (e) {
    report = `⚠️ No se pudo generar el análisis con IA: ${
      e instanceof Error ? e.message : "error desconocido"
    }`;
  }

  await supabase.from("alert_events").insert({
    alert_id: alertId,
    author: uid,
    kind: "note",
    payload: { ai: true, provider: "gemini" },
    note: `🤖 Análisis IA (Gemini Flash)\n\n${report}`,
  });

  await audit("ai_investigate", alertId, userCert);
  revalidatePath(`/console/alerts/${alertId}`);
}

/** Añade una nota de investigación al hilo de la alerta. */
export async function addNote(formData: FormData): Promise<void> {
  const alertId = String(formData.get("alertId"));
  const userCert = String(formData.get("userCert"));
  const note = String(formData.get("note") || "").trim();
  if (!note) return;

  const supabase = await createClient();
  const uid = await currentUserId();

  await supabase.from("alert_events").insert({
    alert_id: alertId,
    author: uid,
    kind: "note",
    note,
  });

  await audit("note", alertId, userCert);
  revalidatePath(`/console/alerts/${alertId}`);
}
