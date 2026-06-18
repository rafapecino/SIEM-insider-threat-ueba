import { createClient } from "@/lib/supabase/server";
import type {
  Alert,
  AlertEvent,
  AuditEntry,
  DailyScore,
  Evidence,
  Profile,
} from "@/lib/types";

export interface AlertFilters {
  status?: string;
  threat?: string;
  department?: string;
  scenario?: number;
  q?: string;
}

/** Cola de alertas (consola interna): incluye ground truth y datos del asignado. */
export async function getAlerts(filters: AlertFilters = {}): Promise<Alert[]> {
  const supabase = await createClient();
  let query = supabase
    .from("alerts")
    .select("*, assignee:profiles!alerts_assigned_to_fkey(id, full_name)")
    .order("risk", { ascending: false })
    .limit(200);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.threat) query = query.eq("threat_type", filters.threat);
  if (filters.department) query = query.eq("department", filters.department);
  if (typeof filters.scenario === "number")
    query = query.eq("scenario", filters.scenario);
  if (filters.q) query = query.ilike("user_cert", `%${filters.q}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Alert[];
}

export async function getAlert(id: string): Promise<Alert | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("*, assignee:profiles!alerts_assigned_to_fkey(id, full_name)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as Alert;
}

export async function getAlertEvents(alertId: string): Promise<AlertEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alert_events")
    .select(
      "*, author_profile:profiles!alert_events_author_fkey(full_name, role)",
    )
    .eq("alert_id", alertId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AlertEvent[];
}

/** Serie diaria de riesgo de un empleado (timeline de investigación). */
export async function getDailyScores(userCert: string): Promise<DailyScore[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_scores")
    .select("user_cert, day, risk, detector, threat_type, is_insider, scenario")
    .eq("user_cert", userCert)
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyScore[];
}

/** Evidencia forense (eventos crudos) del día pico de un empleado. */
export async function getEvidence(
  userCert: string,
  day: string,
): Promise<Evidence[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evidence")
    .select("id, user_cert, day, ts, kind, summary, detail, severity")
    .eq("user_cert", userCert)
    .eq("day", day)
    .order("ts", { ascending: true })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as Evidence[];
}

/** Analistas de la organización (desplegable de asignación). */
export async function getAnalysts(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .in("role", ["analyst", "admin"]);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getDepartments(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alerts")
    .select("department")
    .not("department", "is", null)
    .limit(1000);
  const set = new Set<string>();
  (data ?? []).forEach((r: { department: string | null }) => {
    if (r.department) set.add(r.department);
  });
  return [...set].sort();
}

export interface SummaryKpis {
  total: number;
  open: number;
  investigating: number;
  escalated: number;
  closed: number;
  high: number;
  detected?: number; // solo interno (ground truth)
  insidersTotal?: number;
}

export async function getSummary(
  includeGroundTruth: boolean,
): Promise<SummaryKpis> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("status, risk, is_insider")
    .limit(2000);
  if (error) throw error;
  const rows = data ?? [];
  const k: SummaryKpis = {
    total: rows.length,
    open: rows.filter((r) => r.status === "new").length,
    investigating: rows.filter((r) => r.status === "investigating").length,
    escalated: rows.filter((r) => r.status === "escalated").length,
    closed: rows.filter((r) => ["closed", "false_positive"].includes(r.status))
      .length,
    high: rows.filter((r) => Number(r.risk) >= 90).length,
  };
  if (includeGroundTruth) {
    k.detected = rows.filter((r) => r.is_insider).length;
  }
  return k;
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*, actor_profile:profiles!audit_log_actor_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as AuditEntry[];
}

/* ------------------------- PORTAL DE CLIENTE (vistas) -------------------- */

export async function getPortalAlerts(): Promise<Alert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_portal_alerts")
    .select("*")
    .order("risk", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Alert[];
}
