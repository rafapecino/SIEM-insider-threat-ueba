"""Construye la EVIDENCIA real por alerta a partir de los logs crudos del CERT.

Para el día pico de cada alerta extrae los eventos forenses que un analista del
SOC necesitaría para investigar:
  - file_copy: ficheros copiados a USB (nombre, extensión, firma/magic, PC)
  - usb:       conexiones/desconexiones de dispositivo
  - email:     correos enviados (destinatarios, tamaño, adjuntos, interno/externo)
  - logon:     accesos/salidas por PC (marca fuera de horario)

Inserta en la tabla `public.evidence` vía PostgREST con la clave anon (requiere
RLS temporalmente deshabilitada + grant, como en seed_data_only.py).

Uso:  python scripts/build_evidence.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
from datetime import date, datetime
from pathlib import Path

import polars as pl
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "r4.2"
ORG_ID = "a0000000-0000-0000-0000-000000000001"
INTERNAL_DOMAIN = "dtaa.com"
WORK_START, WORK_END = 8, 18
FMT = "%m/%d/%Y %H:%M:%S"
CAP_PER_KIND = 25  # máx. eventos por tipo y día (legibilidad)

spec = importlib.util.spec_from_file_location("seed", str(ROOT / "scripts" / "seed_supabase.py"))
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)

# Firmas (magic numbers) → tipo real del fichero.
MAGIC = {
    "D0-CF-11-E0": "Documento Office (OLE)",
    "25-50-44-46": "PDF",
    "50-4B-03-04": "ZIP / Office moderno (docx/xlsx)",
    "FF-D8-FF": "Imagen JPEG",
    "89-50-4E-47": "Imagen PNG",
    "47-49-46-38": "Imagen GIF",
    "4D-5A": "Ejecutable Windows (EXE/DLL)",
    "7F-45-4C-46": "Ejecutable Linux (ELF)",
    "1F-8B": "Archivo comprimido GZIP",
}


def magic_label(content: str) -> str:
    c = (content or "").upper()
    for sig, label in MAGIC.items():
        if c.startswith(sig):
            return label
    return "Desconocido"


def load_env() -> tuple[str, str]:
    url = key = None
    for line in (ROOT / "webapp" / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
            url = line.split("=", 1)[1].strip()
        elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
            key = line.split("=", 1)[1].strip()
    if not url or not key:
        sys.exit("Falta URL/anon en webapp/.env.local")
    return url, key


def rest(method, url, key, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{url}/rest/v1/{path}", data=data, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} {method} {path}: {e.read().decode()[:300]}")


def scan_day(csv: str, cols: list[str], users: set[str], peak: dict[str, date]) -> pl.DataFrame:
    """Filtra un CSV crudo a las filas de los usuarios alertados en SU día pico."""
    days = set(peak.values())
    df = (
        pl.scan_csv(RAW / csv)
        .select(cols)
        .filter(pl.col("user").is_in(list(users)))
        .with_columns(pl.col("date").str.to_datetime(FMT, strict=False).alias("ts"))
        .with_columns(pl.col("ts").dt.date().alias("d"))
        .filter(pl.col("d").is_in(list(days)))
        .collect(engine="streaming")
    )
    # Conservar solo (user, su peak_day).
    return df.filter(
        pl.struct(["user", "d"]).map_elements(
            lambda s: peak.get(s["user"]) == s["d"], return_dtype=pl.Boolean
        )
    )


def main() -> None:
    url, key = load_env()
    _, alerts, _ = seed.build_frames()
    peak = {r["user_cert"]: date.fromisoformat(r["peak_day"]) for r in alerts.to_dicts()}
    users = set(peak)
    print(f"Alertas: {len(users)} usuarios · extrayendo evidencia de su día pico…")

    ev: list[dict] = []

    def add(user, ts, kind, summary, detail, severity):
        ev.append({
            "organization_id": ORG_ID, "user_cert": user,
            "day": peak[user].isoformat(), "ts": ts.isoformat(),
            "kind": kind, "summary": summary, "detail": detail, "severity": severity,
        })

    # --- file copies a USB ---
    f = scan_day("file.csv", ["date", "user", "pc", "filename", "content"], users, peak)
    cnt: dict = {}
    for r in f.sort("ts").iter_rows(named=True):
        u = r["user"]; cnt[("file", u)] = cnt.get(("file", u), 0) + 1
        if cnt[("file", u)] > CAP_PER_KIND:
            continue
        ext = (r["filename"].rsplit(".", 1)[-1] if "." in r["filename"] else "—").lower()
        ts = r["ts"]; after = ts.hour < WORK_START or ts.hour >= WORK_END
        real = magic_label(r["content"])
        decoy = ext in ("doc", "docx", "pdf", "txt") and ("Ejecutable" in real or "ZIP" in real)
        add(u, ts, "file_copy",
            f"Copió «{r['filename']}» a un dispositivo USB",
            {"filename": r["filename"], "ext": ext, "tipo_real": real, "pc": r["pc"],
             "fuera_horario": after, "extension_enganosa": decoy},
            "crit" if (after or decoy) else "warn")

    # --- device (USB) ---
    d = scan_day("device.csv", ["date", "user", "pc", "activity"], users, peak)
    cnt = {}
    for r in d.sort("ts").iter_rows(named=True):
        u = r["user"]; cnt[u] = cnt.get(u, 0) + 1
        if cnt[u] > CAP_PER_KIND:
            continue
        ts = r["ts"]; after = ts.hour < WORK_START or ts.hour >= WORK_END
        act = "Conectó" if r["activity"] == "Connect" else "Desconectó"
        add(u, ts, "usb", f"{act} un dispositivo USB en {r['pc']}",
            {"pc": r["pc"], "activity": r["activity"], "fuera_horario": after},
            "warn" if after else "info")

    # --- email ---
    e = scan_day("email.csv", ["date", "user", "pc", "to", "cc", "bcc", "from", "size", "attachments"], users, peak)
    cnt = {}
    for r in e.sort("ts").iter_rows(named=True):
        u = r["user"]; cnt[u] = cnt.get(u, 0) + 1
        if cnt[u] > CAP_PER_KIND:
            continue
        rec = ";".join(x for x in [r["to"], r["cc"], r["bcc"]] if x)
        addrs = [a.strip() for a in rec.split(";") if a.strip()]
        ext_doms = sorted({a.split("@")[-1] for a in addrs if "@" in a and a.split("@")[-1] != INTERNAL_DOMAIN})
        external = bool(ext_doms)
        size_kb = round(int(r["size"] or 0) / 1024)
        att = int(r["attachments"] or 0)
        ts = r["ts"]
        add(u, ts, "email",
            f"Envió un correo a {len(addrs)} destinatario(s)"
            + (f" — {len(ext_doms)} dominio(s) externo(s)" if external else " (interno)")
            + (f", {att} adjunto(s)" if att else ""),
            {"destinatarios": len(addrs), "externos": ext_doms, "tamano_kb": size_kb,
             "adjuntos": att, "from": r["from"], "pc": r["pc"]},
            "crit" if (external and att) else ("warn" if external else "info"))

    # --- logon ---
    g = scan_day("logon.csv", ["date", "user", "pc", "activity"], users, peak)
    cnt = {}
    for r in g.sort("ts").iter_rows(named=True):
        u = r["user"]; cnt[u] = cnt.get(u, 0) + 1
        if cnt[u] > CAP_PER_KIND:
            continue
        ts = r["ts"]; after = ts.hour < WORK_START or ts.hour >= WORK_END
        act = "Inició sesión" if r["activity"] == "Logon" else "Cerró sesión"
        add(u, ts, "logon", f"{act} en {r['pc']}" + (" (fuera de horario)" if after else ""),
            {"pc": r["pc"], "activity": r["activity"], "fuera_horario": after},
            "warn" if after else "info")

    print(f"Eventos de evidencia: {len(ev):,}")

    # Limpiar e insertar.
    rest("DELETE", url, key, f"evidence?organization_id=eq.{ORG_ID}")
    for i in range(0, len(ev), 1000):
        rest("POST", url, key, "evidence", ev[i : i + 1000])
    print("OK · evidencia insertada")


if __name__ == "__main__":
    main()
