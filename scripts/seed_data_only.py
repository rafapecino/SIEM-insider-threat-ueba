"""Carga SOLO datos (daily_scores + alerts) en Supabase usando la clave ANON
vía PostgREST. Pensado para ejecutarse mientras la RLS está temporalmente
deshabilitada en esas dos tablas (se rehabilita después por el MCP).

No requiere service_role. La organización y los usuarios ya existen.

Lee NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY de webapp/.env.local.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from datetime import date
from pathlib import Path

import urllib.request
import urllib.error

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ORG_ID = "a0000000-0000-0000-0000-000000000001"
BATCH_DAILY = 5000
BATCH_ALERTS = 200

spec = importlib.util.spec_from_file_location("seed", str(PROJECT_ROOT / "scripts" / "seed_supabase.py"))
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)


def load_env() -> tuple[str, str]:
    url = key = None
    for line in (PROJECT_ROOT / "webapp" / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
            url = line.split("=", 1)[1].strip()
        elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
            key = line.split("=", 1)[1].strip()
    if not url or not key:
        sys.exit("No encuentro URL/anon key en webapp/.env.local")
    return url, key


def rest(method: str, url: str, key: str, path: str, body=None) -> None:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{url}/rest/v1/{path}", data=data, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} en {method} {path}: {e.read().decode()[:300]}")


def main() -> None:
    url, key = load_env()
    daily, alerts, features = seed.build_frames()

    # Limpiar datos previos de la organización.
    rest("DELETE", url, key, f"alerts?organization_id=eq.{ORG_ID}")
    rest("DELETE", url, key, f"daily_scores?organization_id=eq.{ORG_ID}")

    # daily_scores
    rows = daily.with_columns(seed.pl.lit(ORG_ID).alias("organization_id")).to_dicts()
    for i in range(0, len(rows), BATCH_DAILY):
        rest("POST", url, key, "daily_scores", rows[i : i + BATCH_DAILY])
        print(f"  daily_scores {min(i + BATCH_DAILY, len(rows)):,}/{len(rows):,}", end="\r")
    print()

    # alerts con reasons
    arows = []
    for r in alerts.to_dicts():
        reasons = seed.data.explain_user_day(
            features, r["user_cert"], date.fromisoformat(r["peak_day"]), top_n=5
        )
        arows.append({
            **r,
            "organization_id": ORG_ID,
            "status": "new",
            "reasons": [{"label": x["label"], "value": x["value"], "avg": x["avg"]} for x in reasons],
        })
    for i in range(0, len(arows), BATCH_ALERTS):
        rest("POST", url, key, "alerts", arows[i : i + BATCH_ALERTS])
    print(f"  alerts: {len(arows):,} insertadas")
    print("OK")


if __name__ == "__main__":
    main()
