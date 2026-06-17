# Sentinel UEBA — Plataforma SOC (web)

Portal web de la plataforma SOC de detección de amenazas internas: **login
multi-rol**, **cola de alertas**, **investigación** con trazabilidad y
**auditoría**. Construida sobre el motor de ML del repositorio raíz (los
notebooks generan los scores; esta app los gestiona).

## Stack

- **Next.js 16** (App Router, TypeScript) · **Tailwind v4**
- **Supabase** (Postgres + Auth + RLS) vía `@supabase/ssr`
- **Recharts** para timelines y gráficos
- Despliegue en **Vercel**

## Arquitectura

```
src/
├── middleware.ts              # refresco de sesión + protección de rutas por rol
├── app/
│   ├── login/                 # autenticación (Supabase Auth)
│   ├── console/               # consola del analista (rol analyst|admin)
│   │   ├── alerts/            # cola + detalle/investigación [id]
│   │   ├── analytics/         # composición de la cola y detección
│   │   ├── audit/             # registro de auditoría (solo admin)
│   │   └── actions.ts         # server actions: estado, asignación, nota
│   └── portal/                # portal del cliente (rol client, solo lectura)
├── lib/
│   ├── supabase/{server,client,middleware}.ts
│   ├── auth.ts                # requireSession / requireAnalyst / requireClient
│   ├── queries.ts             # acceso a datos (consola + vistas del portal)
│   ├── types.ts · constants.ts
├── components/                # AppShell, tablas, badges, charts
└── supabase/migrations/       # 0001_schema.sql · 0002_rls.sql
```

## Roles

| Rol       | Área       | Puede                                                            |
| --------- | ---------- | ---------------------------------------------------------------- |
| `analyst` | `/console` | Ver/filtrar cola, investigar, asignar, cambiar estado, notas     |
| `admin`   | `/console` | Todo lo anterior + registro de **auditoría**                     |
| `client`  | `/portal`  | Ver estado agregado y gestión de alertas de su organización (RO) |

El portal del cliente consulta **vistas** (`v_portal_*`) que omiten las columnas
de _ground truth_ (`is_insider`, `scenario`); la RLS limita las filas a su
organización.

## Puesta en marcha (local)

```bash
cp .env.local.example .env.local   # rellena URL + anon + service_role
npm install
npm run dev                        # http://localhost:3000
```

La base de datos se crea aplicando `supabase/migrations/*.sql` y se puebla con
`python ../scripts/seed_supabase.py` (desde la raíz del repo).

## Cuentas demo

| Email                       | Rol     | Contraseña      |
| --------------------------- | ------- | --------------- |
| `analyst@soc-demo.com`      | analyst | `Sentinel#2026` |
| `admin@soc-demo.com`        | admin   | `Sentinel#2026` |
| `client@northcorp-demo.com` | client  | `Sentinel#2026` |

> Entorno de **demostración** sobre el dataset CERT r4.2. No usar estas
> credenciales ni este esquema tal cual en producción.

## Variables de entorno

| Variable                        | Dónde            | Notas                         |
| ------------------------------- | ---------------- | ----------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | cliente + server | pública                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente + server | pública                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | **solo server**  | seed/admin · nunca al cliente |
