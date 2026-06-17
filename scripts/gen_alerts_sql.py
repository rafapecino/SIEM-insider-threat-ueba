"""Genera el SQL de inserción de la cola de alertas (387) en lotes.

Reutiliza build_frames() de seed_supabase.py. Escribe ficheros
C:/tmp/alerts_batch_XX.sql que se aplican vía el MCP de Supabase.
No requiere credenciales (solo lee los parquets locales).
"""
from __future__ import annotations

import importlib.util
import json
from datetime import date
from pathlib import Path

ORG = "a0000000-0000-0000-0000-000000000001"
OUT = Path("C:/tmp")
BATCH = 130

spec = importlib.util.spec_from_file_location("seed", "scripts/seed_supabase.py")
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)


def q(v) -> str:
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def main() -> None:
    _, alerts, features = seed.build_frames()
    rows = alerts.to_dicts()

    values = []
    for r in rows:
        reasons = seed.data.explain_user_day(
            features, r["user_cert"], date.fromisoformat(r["peak_day"]), top_n=5
        )
        reasons_json = json.dumps(
            [{"label": x["label"], "value": x["value"], "avg": x["avg"]} for x in reasons]
        )
        values.append(
            "(" + ", ".join([
                f"'{ORG}'",
                q(r["user_cert"]),
                q(r["peak_day"]),
                str(round(float(r["risk"]), 2)),
                q(r["detector"]),
                q(r["threat_type"]),
                q(r["department"]),
                q(r["role_cert"]),
                ("null" if r["scenario"] is None else str(int(r["scenario"]))),
                ("true" if r["is_insider"] else "false"),
                "'new'",
                q(reasons_json) + "::jsonb",
            ]) + ")"
        )

    OUT.mkdir(parents=True, exist_ok=True)
    cols = ("organization_id, user_cert, peak_day, risk, detector, threat_type, "
            "department, role_cert, scenario, is_insider, status, reasons")
    n = 0
    for i in range(0, len(values), BATCH):
        chunk = values[i : i + BATCH]
        sql = (
            f"insert into public.alerts ({cols}) values\n"
            + ",\n".join(chunk)
            + "\non conflict (organization_id, user_cert) do nothing;\n"
        )
        f = OUT / f"alerts_batch_{n:02d}.sql"
        f.write_text(sql, encoding="utf-8")
        print(f"{f}  ({len(chunk)} filas, {len(sql)//1024} KB)")
        n += 1
    print(f"TOTAL: {len(values)} alertas en {n} lotes")


if __name__ == "__main__":
    main()
