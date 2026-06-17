// Tipos del dominio SOC (espejo del esquema Supabase).

export type Role = "analyst" | "admin" | "client";

export type AlertStatus =
  | "new"
  | "investigating"
  | "escalated"
  | "closed"
  | "false_positive";

export type EventKind = "status_change" | "note" | "assignment" | "acknowledge";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  organization_id: string | null;
}

export interface Organization {
  id: string;
  name: string;
}

export interface AlertReason {
  label: string;
  value: number;
  avg: number;
}

export interface Alert {
  id: string;
  user_cert: string;
  peak_day: string;
  risk: number; // 0-100
  detector: string;
  threat_type: string;
  department: string | null;
  role_cert: string | null;
  scenario: number | null;
  is_insider: boolean | null;
  status: AlertStatus;
  assigned_to: string | null;
  organization_id: string;
  reasons: AlertReason[] | null;
  created_at: string;
  // join opcional
  assignee?: Pick<Profile, "id" | "full_name"> | null;
}

export interface DailyScore {
  user_cert: string;
  day: string;
  risk: number; // 0-100
  detector: string;
  threat_type: string | null;
  is_insider: boolean | null;
  scenario: number | null;
}

export interface AlertEvent {
  id: string;
  alert_id: string;
  author: string | null;
  kind: EventKind;
  payload: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
  author_profile?: Pick<Profile, "full_name" | "role"> | null;
}

export interface AuditEntry {
  id: string;
  actor: string | null;
  action: string;
  target_alert: string | null;
  target_user_cert: string | null;
  created_at: string;
  actor_profile?: Pick<Profile, "full_name" | "role"> | null;
}
