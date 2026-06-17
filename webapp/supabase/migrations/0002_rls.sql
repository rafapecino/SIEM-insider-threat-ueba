-- ============================================================================
-- Sentinel UEBA — RLS, funciones auxiliares y vistas del portal de cliente
-- ============================================================================

-- Funciones SECURITY DEFINER: leen el perfil del usuario actual SIN disparar
-- RLS de forma recursiva. STABLE para que el planner las cachee por consulta.
create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_org()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_internal()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('analyst','admin'), false);
$$;

-- ---------------------------------------------------------------------------
-- Habilitar RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.daily_scores  enable row level security;
alter table public.alerts        enable row level security;
alter table public.alert_events  enable row level security;
alter table public.audit_log     enable row level security;

-- organizations: visibles para los miembros de la organización.
drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations
  for select using (id = public.auth_org());

-- profiles: el usuario ve su perfil; los internos ven los de su organización
-- (necesario para el desplegable de asignación).
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select using (
    id = auth.uid()
    or (public.is_internal() and organization_id = public.auth_org())
  );

-- daily_scores: lectura por organización (RLS de fila). El cliente accede a
-- través de la vista v_portal_daily_scores, que oculta el ground truth.
drop policy if exists ds_read on public.daily_scores;
create policy ds_read on public.daily_scores
  for select using (organization_id = public.auth_org());

-- alerts: lectura por organización; escritura/gestión solo roles internos.
drop policy if exists alerts_read on public.alerts;
create policy alerts_read on public.alerts
  for select using (organization_id = public.auth_org());

drop policy if exists alerts_write on public.alerts;
create policy alerts_write on public.alerts
  for update using (public.is_internal() and organization_id = public.auth_org())
  with check (public.is_internal() and organization_id = public.auth_org());

-- alert_events: visibles para miembros de la organización de la alerta;
-- insertables por cualquier miembro autenticado de esa organización
-- (clientes pueden dejar "acuse de recibo"/nota).
drop policy if exists ae_read on public.alert_events;
create policy ae_read on public.alert_events
  for select using (
    exists (
      select 1 from public.alerts a
      where a.id = alert_events.alert_id and a.organization_id = public.auth_org()
    )
  );

drop policy if exists ae_insert on public.alert_events;
create policy ae_insert on public.alert_events
  for insert with check (
    author = auth.uid()
    and exists (
      select 1 from public.alerts a
      where a.id = alert_events.alert_id and a.organization_id = public.auth_org()
    )
  );

-- audit_log: insertable por autenticados; legible solo por admin.
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert with check (actor = auth.uid());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log
  for select using (public.auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Vistas del PORTAL DE CLIENTE: omiten columnas de ground truth (is_insider,
-- scenario). security_invoker = on → respetan la RLS de fila del usuario.
-- ---------------------------------------------------------------------------
create or replace view public.v_portal_alerts
  with (security_invoker = on) as
  select id, organization_id, user_cert, peak_day, risk, detector,
         threat_type, department, role_cert, status, assigned_to,
         reasons, created_at, updated_at
  from public.alerts;

create or replace view public.v_portal_daily_scores
  with (security_invoker = on) as
  select organization_id, user_cert, day, risk, detector, threat_type
  from public.daily_scores;

grant select on public.v_portal_alerts to authenticated;
grant select on public.v_portal_daily_scores to authenticated;
