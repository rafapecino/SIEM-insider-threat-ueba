"""ETL: carga los scores del motor UEBA en Supabase para la plataforma SOC.

Reutiliza la lógica ya validada de `dashboard/data.py` (riesgo unificado,
atribución de detector, clasificación de amenaza) y vuelca:
  - `daily_scores`: serie diaria de riesgo por empleado (timelines).
  - `alerts`: cola de alertas (1 por empleado-pico sobre el umbral) con las
    conductas destacadas (`reasons`) del día pico.

También crea la organización demo y las cuentas de usuario (analista, admin,
cliente) con sus perfiles/roles.

Uso:
    # Define las credenciales del proyecto Supabase (Project Settings → API):
    set SUPABASE_URL=https://xxxx.supabase.co
    set SUPABASE_SERVICE_ROLE_KEY=eyJ...           # service_role (NO la anon)
    python scripts/seed_supabase.py

Requiere: pip install supabase  (ver requirements.txt).
"""
from __future__ import annotations

import os
import sys
from datetime import date as _date
from pathlib import Path

import polars as pl

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dashboard import data  # noqa: E402

# --------------------------------------------------------------------------- #
# Configuración
# --------------------------------------------------------------------------- #
ORG_NAME = "Northcorp Industries"
ALERTS_PER_DAY = 10.0          # presupuesto de alertas → umbral de la cola
BATCH = 2000                   # filas por inserción en daily_scores

# Cuentas demo (entorno de demostración; documentadas en el README).
DEMO_USERS = [
    {"email": "analyst@soc-demo.com", "password": "Sentinel#2026", "role": "analyst", "name": "SOC Analyst"},
    {"email": "admin@soc-demo.com", "password": "Sentinel#2026", "role": "admin", "name": "SOC Admin"},
    {"email": "client@northcorp-demo.com", "password": "Sentinel#2026", "role": "client", "name": "Northcorp · Seguridad"},
]


def _load_env() -> tuple[str, str]:
    """URL + service_role key desde el entorno o webapp/.env.local."""
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    env_file = PROJECT_ROOT / "webapp" / ".env.local"
    if (not url or not key) and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if k in ("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL") and not url:
                url = v
            if k == "SUPABASE_SERVICE_ROLE_KEY" and not key:
                key = v

    if not url or not key:
        sys.exit(
            "Faltan credenciales. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY "
            "(o ponlas en webapp/.env.local)."
        )
    return url, key


def build_frames() -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    """Devuelve (daily_scores, alerts, features) listos para insertar/usar."""
    scores = data.load_scores()
    features = data.load_features()

    enriched = data.add_unified_risk(scores)  # risk + detector
    threats = data.classify_threats(features)  # user, day, threat_type
    threats = threats.join(
        features.select("user", "day", "role", "department"),
        on=["user", "day"], how="left",
    )

    # ---- daily_scores: todas las filas, riesgo 0-100 + detector legible ----
    enr = enriched.join(
        threats.select("user", "day", "threat_type"), on=["user", "day"], how="left"
    )
    daily = enr.select(
        pl.col("user").alias("user_cert"),
        pl.col("day").cast(pl.Utf8).alias("day"),
        (pl.col("risk") * 100).round(2).alias("risk"),
        pl.col("detector").replace(data.MODELS).alias("detector"),
        pl.col("threat_type"),
        pl.col("scenario").cast(pl.Int64).alias("scenario"),
        pl.col("is_insider_user").alias("is_insider"),
    )

    # ---- alerts: 1 por usuario-pico sobre el umbral de ALERTS_PER_DAY ----
    threshold = data.threshold_for_alert_rate(enriched, "risk", ALERTS_PER_DAY)
    wl = data.risk_watchlist(
        enriched, threats, top_n=10_000, filters={"risk_min": threshold}
    )
    alerts = wl.select(
        pl.col("user").alias("user_cert"),
        pl.col("peak_day").cast(pl.Utf8).alias("peak_day"),
        pl.col("risk"),  # ya 0-100
        pl.col("detector"),
        pl.col("threat_type"),
        pl.col("department"),
        pl.col("role").alias("role_cert"),
        pl.col("scenario").cast(pl.Int64).alias("scenario"),
        pl.col("is_insider_user").alias("is_insider"),
    )
    return daily, alerts, features


def main() -> None:
    from supabase import create_client

    url, key = _load_env()
    sb = create_client(url, key)

    daily, alerts, features = build_frames()
    print(f"daily_scores: {daily.height:,} filas · alerts: {alerts.height:,} empleados")

    # 1) Organización ------------------------------------------------------- #
    existing = sb.table("organizations").select("id").eq("name", ORG_NAME).execute()
    if existing.data:
        org_id = existing.data[0]["id"]
    else:
        org_id = sb.table("organizations").insert({"name": ORG_NAME}).execute().data[0]["id"]
    print(f"Organización: {ORG_NAME} ({org_id})")

    # 2) Usuarios + perfiles ------------------------------------------------ #
    for u in DEMO_USERS:
        try:
            res = sb.auth.admin.create_user(
                {"email": u["email"], "password": u["password"], "email_confirm": True}
            )
            uid = res.user.id
        except Exception:
            # Ya existe: localizar su id paginando usuarios.
            uid = None
            for page in range(1, 20):
                users = sb.auth.admin.list_users(page=page, per_page=200)
                lst = users if isinstance(users, list) else getattr(users, "users", [])
                for usr in lst:
                    if getattr(usr, "email", None) == u["email"]:
                        uid = usr.id
                        break
                if uid or not lst:
                    break
        if not uid:
            print(f"  ! No se pudo crear/encontrar {u['email']}")
            continue
        sb.table("profiles").upsert(
            {
                "id": uid,
                "full_name": u["name"],
                "role": u["role"],
                "organization_id": org_id,
            }
        ).execute()
        print(f"  Usuario {u['email']} → rol {u['role']}")

    # 3) Limpiar datos previos de la organización --------------------------- #
    sb.table("alerts").delete().eq("organization_id", org_id).execute()
    sb.table("daily_scores").delete().eq("organization_id", org_id).execute()

    # 4) daily_scores (en lotes) ------------------------------------------- #
    rows = daily.with_columns(pl.lit(org_id).alias("organization_id")).to_dicts()
    for i in range(0, len(rows), BATCH):
        sb.table("daily_scores").insert(rows[i : i + BATCH]).execute()
        print(f"  daily_scores {min(i + BATCH, len(rows)):,}/{len(rows):,}", end="\r")
    print()

    # 5) alerts con reasons del día pico ----------------------------------- #
    alert_rows = []
    for r in alerts.to_dicts():
        reasons = data.explain_user_day(
            features, r["user_cert"], _date.fromisoformat(r["peak_day"]), top_n=5
        )
        alert_rows.append(
            {
                **r,
                "organization_id": org_id,
                "status": "new",
                "reasons": [
                    {"label": x["label"], "value": x["value"], "avg": x["avg"]}
                    for x in reasons
                ],
            }
        )
    for i in range(0, len(alert_rows), 500):
        sb.table("alerts").insert(alert_rows[i : i + 500]).execute()
    print(f"  alerts: {len(alert_rows):,} insertadas")

    print("\n✅ Seed completado.")


if __name__ == "__main__":
    main()
