"""Recalibra el riesgo con Monte Carlo por usuario para eliminar la saturación
(todo a 100) y diferenciar verdaderos positivos de falsos positivos.

Idea:
  1. Combina los 4 detectores en una anomalía diaria `a` (media de z-scores de
     población, recortados a la dirección anómala).
  2. Para cada usuario, construye un NULL de Monte Carlo de su comportamiento
     "normal" (bootstrap de sus días por debajo del percentil 95) y simula el
     MÁXIMO que su variabilidad normal produciría en ~n días (B repeticiones).
  3. El día pico recibe un p-valor MC = P(máx_null >= pico). La "confianza"
     conf = 1 - p escala el riesgo del usuario: si su pico cabe dentro de lo
     normal (FP), conf baja y el riesgo se reduce; si lo excede con claridad
     (exfiltración real), conf ~ 1 y el riesgo se mantiene alto.
  4. Riesgo diario = logística de la z personal robusta, escalada por conf.

Reescribe daily_scores (timeline) y actualiza alerts.risk/detector SIN cambiar
qué alertas existen (preserva ids y evidencia). Requiere RLS temporalmente
deshabilitada + grants (igual que seed_data_only.py).
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
import polars as pl
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
ORG_ID = "a0000000-0000-0000-0000-000000000001"
B = 1500           # repeticiones Monte Carlo
CENTER = 3.0       # z personal robusta en la que el riesgo diario vale 50
RNG = np.random.default_rng(7)

spec = importlib.util.spec_from_file_location("seed", str(ROOT / "scripts" / "seed_supabase.py"))
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)
data = seed.data


def load_env() -> tuple[str, str]:
    url = key = None
    for line in (ROOT / "webapp" / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
            url = line.split("=", 1)[1].strip()
        elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
            key = line.split("=", 1)[1].strip()
    return url, key


def rest(method, url, key, path, body=None):
    d = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{url}/rest/v1/{path}", data=d, method=method)
    r.add_header("apikey", key); r.add_header("Authorization", f"Bearer {key}")
    r.add_header("Content-Type", "application/json"); r.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(r, timeout=180) as x:
            x.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} {method} {path}: {e.read().decode()[:300]}")


def main() -> None:
    url, key = load_env()
    scores = data.load_scores()
    features = data.load_features()
    models = list(data.MODELS.keys())

    # 1) z-score de población por modelo, recortado a la dirección anómala.
    Z = []
    for m in models:
        x = scores[m].to_numpy().astype(float)
        z = np.clip((x - x.mean()) / (x.std() + 1e-9), 0, None)
        Z.append(z)
    Z = np.vstack(Z).T                      # (N, 4)
    a = Z.mean(axis=1)                       # anomalía combinada diaria
    det_idx = Z.argmax(axis=1)              # detector responsable por día

    users = scores["user"].to_numpy()
    days = scores["day"].cast(pl.Utf8).to_numpy()
    is_ins = scores["is_insider_user"].to_numpy()
    scen = scores["scenario"].to_numpy()

    # 2-3) por usuario: magnitud del pico × confianza Monte Carlo.
    uniq = np.unique(users)
    idx_of = {u: np.where(users == u)[0] for u in uniq}
    peak_a = np.zeros(len(uniq))
    mu_a = np.zeros(len(uniq))
    sev = np.zeros(len(uniq))          # magnitud·confianza (escalar por usuario)
    for k, u in enumerate(uniq):
        au = a[idx_of[u]]
        n = len(au)
        mu_a[k] = np.median(au)
        peak_a[k] = au.max()
        q95 = np.quantile(au, 0.95)
        pool = au[au <= q95]
        if pool.size < 5:
            pool = au
        sims = RNG.choice(pool, size=(B, n)).max(axis=1)
        conf = 1.0 - (1 + np.sum(sims >= peak_a[k])) / (B + 1)
        sev[k] = peak_a[k] * conf

    # 4) riesgo de alerta = percentil de la severidad ENTRE USUARIOS (0-100).
    order = sev.argsort()
    rank = np.empty_like(order)
    rank[order] = np.arange(len(sev))
    risk_alert = 100.0 * rank / max(len(sev) - 1, 1)

    # riesgo diario: el pico vale risk_alert del usuario; los días normales ~0.
    risk_day = np.zeros(len(a))
    for k, u in enumerate(uniq):
        idx = idx_of[u]
        denom = max(peak_a[k] - mu_a[k], 1e-9)
        frac = np.clip((a[idx] - mu_a[k]) / denom, 0.0, 1.0)
        risk_day[idx] = risk_alert[k] * frac

    # detector legible por día
    det_legible = np.array([data.MODELS[models[i]] for i in det_idx])

    # threat_type por (user, day)
    threats = data.classify_threats(features)

    daily = pl.DataFrame({
        "user_cert": users, "day": days,
        "risk": np.round(risk_day, 2),
        "detector": det_legible,
        "scenario": scen.astype("int64"),
        "is_insider": is_ins.astype(bool),
    }).join(
        threats.rename({"user": "user_cert"}).with_columns(pl.col("day").cast(pl.Utf8)),
        on=["user_cert", "day"], how="left",
    ).with_columns(pl.lit(ORG_ID).alias("organization_id"))

    # pico por usuario (para actualizar alerts)
    peak_rows = (
        daily.sort("risk", descending=True).group_by("user_cert").head(1)
        .select("user_cert", "risk", "detector")
    )
    print(f"Riesgo recalibrado · alertas spread: "
          f"min={peak_rows['risk'].min():.1f} "
          f"med={peak_rows['risk'].median():.1f} "
          f"max={peak_rows['risk'].max():.1f}")

    # 5) reescribir daily_scores (la tabla se vacía aparte, vía MCP server-side)
    rows = daily.select(
        "organization_id", "user_cert", "day", "risk", "detector",
        "threat_type", "scenario", "is_insider"
    ).to_dicts()
    for i in range(0, len(rows), 5000):
        rest("POST", url, key, "daily_scores", rows[i : i + 5000])
        print(f"  daily_scores {min(i + 5000, len(rows)):,}/{len(rows):,}", end="\r")
    print()

    # 6) actualizar alerts.risk/detector (sin tocar selección/ids/evidencia)
    pk = {r["user_cert"]: (r["risk"], r["detector"]) for r in peak_rows.to_dicts()}
    n_upd = 0
    for uc, (rk, det) in pk.items():
        rest("PATCH", url, key, f"alerts?organization_id=eq.{ORG_ID}&user_cert=eq.{uc}",
             {"risk": rk, "detector": det})
        n_upd += 1
    print(f"  alerts actualizadas: {n_upd}")
    print("OK")


if __name__ == "__main__":
    main()
