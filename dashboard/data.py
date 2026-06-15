"""Lógica de datos del dashboard SIEM (sin dependencias de Streamlit).

Carga los parquets generados en las fases 2-4 y calcula las agregaciones
necesarias para la UI (watchlist, métricas de alertas, timelines por usuario).
Este módulo es testeable de forma independiente: no importa streamlit.
"""
import sys
from pathlib import Path

import polars as pl

# Resolución robusta del directorio de parquets: intenta usar src.config
# (añadiendo la raíz del proyecto a sys.path) y si falla, usa un fallback
# relativo a este fichero.
try:
    _PROJECT_ROOT = Path(__file__).resolve().parent.parent
    if str(_PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(_PROJECT_ROOT))
    from src.config import PROCESSED_DIR
except Exception:
    PROCESSED_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"

SCORES_FILE = PROCESSED_DIR / "user_day_scores.parquet"
FEATURES_FILE = PROCESSED_DIR / "user_day_features.parquet"

# Modelos disponibles: clave de columna -> nombre legible para la UI
MODELS = {
    "score_rules": "Reglas",
    "score_iforest": "Isolation Forest",
    "score_autoencoder": "Autoencoder",
    "score_transformer": "Transformer temporal",
}

# Especialidad de cada detector: en qué tipo de amenaza es más fiable.
MODEL_SPECIALTY = {
    "score_rules": "Accesos fuera de horario y uso de USB (robo directo)",
    "score_iforest": "Anomalías generales de comportamiento",
    "score_autoencoder": "Desviaciones sutiles del patrón normal",
    "score_transformer": "Cambios y escaladas en el tiempo",
}

# Tipos de amenaza (casuística) detectables a partir de la conducta cruda.
THREAT_TYPES = [
    "Exfiltración por USB",
    "Acceso a PC ajeno",
    "Fuga por email",
    "Actividad fuera de horario",
    "Uso de USB",
    "Comportamiento normal",
]

# Las 7 features "sospechosas" usadas por el baseline de reglas, mostradas
# en el drill-down por usuario para explicar por qué un día es anómalo.
SUSPICIOUS_FEATURES = [
    "n_afterhours_usb",
    "n_usb_connects",
    "n_afterhours_logons",
    "n_other_pc_logons",
    "n_external_emails",
    "n_file_copies",
    "n_afterhours_file_copies",
]

# Nombres en lenguaje llano para la UI (no técnico).
FEATURE_LABELS = {
    "n_usb_connects": "Conexiones de memoria USB",
    "n_afterhours_usb": "USB conectada fuera de horario",
    "n_afterhours_logons": "Accesos fuera de horario",
    "n_other_pc_logons": "Accesos desde un PC ajeno",
    "n_external_emails": "Emails a direcciones externas",
    "n_file_copies": "Ficheros copiados a USB",
    "n_afterhours_file_copies": "Copias de ficheros fuera de horario",
}

# Niveles de riesgo y su color (semáforo).
RISK_COLORS = {"Alto": "#e03131", "Medio": "#f08c00", "Bajo": "#2f9e44"}


def risk_band(score: float, threshold: float, p95: float) -> str:
    """Clasifica un score en un nivel de riesgo de semáforo.

    - Alto: supera el umbral de alerta (se investigaría).
    - Medio: por debajo del umbral pero en el 5% superior de la población.
    - Bajo: comportamiento normal.
    """
    if score >= threshold:
        return "Alto"
    if score >= p95:
        return "Medio"
    return "Bajo"


def score_p95(scores: pl.DataFrame, model: str) -> float:
    """Percentil 95 del score, usado como corte del nivel de riesgo 'Medio'."""
    return float(scores.select(pl.col(model).quantile(0.95, "higher")).item())


def explain_user_day(
    features: pl.DataFrame, user: str, day, top_n: int = 4
) -> list[dict]:
    """Explica en lenguaje llano por qué un día concreto de un usuario es
    sospechoso: compara su comportamiento ese día con SU PROPIA media histórica.

    Devuelve una lista de dicts {label, value, avg} con las conductas que ese
    día estuvieron por encima de lo habitual para ese usuario, ordenadas por
    cuánto se desvían. Si no hay nada elevado, devuelve lista vacía.
    """
    day_row = features.filter(
        (pl.col("user") == user) & (pl.col("day") == day)
    ).select(SUSPICIOUS_FEATURES)
    if day_row.height == 0:
        return []

    user_avg = (
        features.filter(pl.col("user") == user)
        .select([pl.col(f).mean().alias(f) for f in SUSPICIOUS_FEATURES])
    )

    reasons = []
    for f in SUSPICIOUS_FEATURES:
        value = float(day_row[f][0])
        avg = float(user_avg[f][0])
        if value > 0 and value > avg:
            reasons.append(
                {
                    "label": FEATURE_LABELS[f],
                    "value": value,
                    "avg": avg,
                    "delta": value - avg,
                }
            )

    reasons.sort(key=lambda r: r["delta"], reverse=True)
    return reasons[:top_n]


def load_scores() -> pl.DataFrame:
    """Carga la tabla de scores usuario-día."""
    return pl.read_parquet(SCORES_FILE)


def load_features() -> pl.DataFrame:
    """Carga la tabla de features usuario-día."""
    return pl.read_parquet(FEATURES_FILE)


def user_watchlist(scores: pl.DataFrame, model: str, top_n: int = 50) -> pl.DataFrame:
    """Ranking de usuarios por su score máximo en el modelo elegido.

    Devuelve, por usuario: el score máximo observado, el día en que se
    produjo ese máximo, si es un insider conocido y su escenario.
    """
    # Para cada usuario nos quedamos con la fila de su score máximo,
    # de la que extraemos el día (peak_day) y los metadatos de insider.
    per_user_max = (
        scores.sort(model, descending=True)
        .group_by("user")
        .head(1)
        .select(
            "user",
            pl.col(model).alias("max_score"),
            pl.col("day").alias("peak_day"),
            "is_insider_user",
            "scenario",
        )
        .sort("max_score", descending=True)
        .head(top_n)
    )
    return per_user_max


def alerts_at_threshold(scores: pl.DataFrame, model: str, threshold: float) -> dict:
    """Métricas operativas de alertas para un umbral dado.

    Devuelve un dict con:
    - n_alerts: nº de user-días con score >= threshold.
    - alerts_per_day: alertas / nº de días calendario distintos.
    - recall: fracción de días maliciosos (label_malicious_day == 1)
      que generan alerta.
    - precision: fracción de alertas que corresponden a días maliciosos.
    """
    n_days = scores.select(pl.col("day").n_unique()).item()

    alerted = scores.filter(pl.col(model) >= threshold)
    n_alerts = alerted.height

    n_malicious = scores.filter(pl.col("label_malicious_day") == 1).height
    n_true_positives = alerted.filter(pl.col("label_malicious_day") == 1).height

    recall = (n_true_positives / n_malicious) if n_malicious > 0 else 0.0
    precision = (n_true_positives / n_alerts) if n_alerts > 0 else 0.0
    alerts_per_day = (n_alerts / n_days) if n_days > 0 else 0.0

    return {
        "n_alerts": n_alerts,
        "alerts_per_day": alerts_per_day,
        "recall": recall,
        "precision": precision,
    }


def user_timeline(
    scores: pl.DataFrame, features: pl.DataFrame, user: str, model: str
) -> pl.DataFrame:
    """Serie temporal de un usuario: score del modelo elegido + features
    sospechosas crudas, ordenada por día.
    """
    user_scores = scores.filter(pl.col("user") == user).select(
        "user", "day", pl.col(model).alias("score"), "label_malicious_day"
    )
    user_features = features.filter(pl.col("user") == user).select(
        "user", "day", *SUSPICIOUS_FEATURES
    )

    timeline = user_scores.join(user_features, on=["user", "day"], how="inner").sort(
        "day"
    )
    return timeline


def add_unified_risk(scores: pl.DataFrame) -> pl.DataFrame:
    """Añade al dataframe de scores el riesgo unificado multi-detector.

    Para cada uno de los 4 modelos calcula su percentil (`<model>_pct`,
    0-1, mayor=más anómalo). El `risk` final es el MÁXIMO percentil entre
    los 4 detectores (si cualquier especialista lo ve muy anómalo, salta),
    y `detector` es la clave del modelo responsable de ese máximo.
    """
    height = scores.height
    pct_cols = [
        (pl.col(m).rank(method="average") / height).alias(f"{m}_pct")
        for m in MODELS
    ]
    out = scores.with_columns(pct_cols)

    pct_names = [f"{m}_pct" for m in MODELS]
    out = out.with_columns(
        pl.max_horizontal(pct_names).alias("risk")
    )

    # Detector responsable: el de mayor percentil para esa fila.
    detector_expr = pl.lit(list(MODELS.keys())[0])
    for m in list(MODELS.keys())[1:]:
        detector_expr = (
            pl.when(pl.col(f"{m}_pct") == pl.col("risk"))
            .then(pl.lit(m))
            .otherwise(detector_expr)
        )
    out = out.with_columns(detector_expr.alias("detector"))

    return out


def classify_threats(features: pl.DataFrame) -> pl.DataFrame:
    """Clasifica cada usuario-día en un tipo de amenaza (casuística) según
    su conducta cruda dominante, con prioridad descendente.

    Devuelve un dataframe (user, day, threat_type).
    """
    # Media de emails externos por usuario, para "Fuga por email".
    user_email_avg = features.group_by("user").agg(
        pl.col("n_external_emails").mean().alias("avg_external_emails")
    )

    df = features.select(
        "user", "day",
        "n_file_copies", "n_afterhours_file_copies",
        "n_other_pc_logons", "n_external_emails",
        "n_afterhours_logons", "n_afterhours_usb", "n_usb_connects",
    ).join(user_email_avg, on="user", how="left")

    threat_type = (
        pl.when(
            (pl.col("n_file_copies") > 0) | (pl.col("n_afterhours_file_copies") > 0)
        ).then(pl.lit("Exfiltración por USB"))
        .when(pl.col("n_other_pc_logons") > 0).then(pl.lit("Acceso a PC ajeno"))
        .when(
            (pl.col("n_external_emails") > 0)
            & (pl.col("n_external_emails") > pl.col("avg_external_emails"))
        ).then(pl.lit("Fuga por email"))
        .when(
            (pl.col("n_afterhours_logons") > 0) | (pl.col("n_afterhours_usb") > 0)
        ).then(pl.lit("Actividad fuera de horario"))
        .when(pl.col("n_usb_connects") > 0).then(pl.lit("Uso de USB"))
        .otherwise(pl.lit("Comportamiento normal"))
        .alias("threat_type")
    )

    return df.with_columns(threat_type).select("user", "day", "threat_type")


def detector_label(key: str) -> str:
    """Nombre legible de un detector a partir de su clave de columna."""
    return MODELS.get(key, key)


def scenario_name(n) -> str:
    """Nombre legible de un escenario del ground truth."""
    names = {
        0: "—",
        1: "Esc.1: Fuga a Wikileaks",
        2: "Esc.2: Robo antes de marcharse",
        3: "Esc.3: Sabotaje de sysadmin",
    }
    try:
        return names.get(int(n), "—")
    except (TypeError, ValueError):
        return "—"


def risk_watchlist(
    scores_enriched: pl.DataFrame,
    features_threats: pl.DataFrame,
    top_n: int = 50,
    filters: dict | None = None,
) -> pl.DataFrame:
    """Ranking de usuarios por su riesgo unificado máximo (multi-detector).

    `scores_enriched` debe llevar ya las columnas `risk` y `detector`
    (ver `add_unified_risk`). `features_threats` debe llevar `threat_type`
    por (user, day) (ver `classify_threats`).

    `filters` (opcional) admite las claves:
    - risk_min: float 0-1, riesgo mínimo (se aplica ANTES de agregar).
    - threat_type: lista de tipos de amenaza permitidos.
    - department: lista de departamentos permitidos.
    - scenario: int, escenario del ground truth (modo demo).

    Devuelve por usuario: peak_day, risk (0-100, 1 decimal), detector
    (nombre legible), threat_type del día pico, role, department,
    is_insider_user, scenario.
    """
    join_cols = ["user", "day", "threat_type"]
    extra_cols = [c for c in ("role", "department") if c in features_threats.columns]
    df = scores_enriched.join(
        features_threats.select(*join_cols, *extra_cols),
        on=["user", "day"], how="left",
    )

    filters = filters or {}
    if filters.get("risk_min") is not None:
        df = df.filter(pl.col("risk") >= filters["risk_min"])
    if filters.get("threat_type"):
        df = df.filter(pl.col("threat_type").is_in(filters["threat_type"]))
    if filters.get("department"):
        df = df.filter(pl.col("department").is_in(filters["department"]))
    if filters.get("scenario") is not None:
        df = df.filter(pl.col("scenario") == filters["scenario"])

    if df.height == 0:
        return df.head(0).select(
            "user", "peak_day", "risk", "detector", "threat_type",
            "role", "department", "is_insider_user", "scenario",
        )

    per_user_max = (
        df.sort("risk", descending=True)
        .group_by("user")
        .head(1)
        .with_columns(
            (pl.col("risk") * 100).round(1).alias("risk"),
            pl.col("day").alias("peak_day"),
            pl.col("detector").replace(MODELS).alias("detector"),
        )
        .select(
            "user", "peak_day", "risk", "detector", "threat_type",
            "role", "department", "is_insider_user", "scenario",
        )
        .sort("risk", descending=True)
        .head(top_n)
    )
    return per_user_max


def alerts_summary(scores_enriched: pl.DataFrame, risk_threshold: float) -> dict:
    """Métricas operativas de alertas usando el riesgo unificado `risk`.

    Igual que `alerts_at_threshold` pero sobre la columna `risk`.
    """
    n_days = scores_enriched.select(pl.col("day").n_unique()).item()

    alerted = scores_enriched.filter(pl.col("risk") >= risk_threshold)
    n_alerts = alerted.height

    n_malicious = scores_enriched.filter(pl.col("label_malicious_day") == 1).height
    n_true_positives = alerted.filter(pl.col("label_malicious_day") == 1).height

    recall = (n_true_positives / n_malicious) if n_malicious > 0 else 0.0
    precision = (n_true_positives / n_alerts) if n_alerts > 0 else 0.0
    alerts_per_day = (n_alerts / n_days) if n_days > 0 else 0.0

    return {
        "n_alerts": n_alerts,
        "alerts_per_day": alerts_per_day,
        "recall": recall,
        "precision": precision,
    }


def threshold_for_alert_rate(
    scores: pl.DataFrame, model: str, alerts_per_day: float = 10.0
) -> float:
    """Calcula el umbral de score que produce ~`alerts_per_day` alertas/día.

    Se obtiene como el percentil correspondiente de la distribución de
    scores: si hay N días calendario, queremos `alerts_per_day * N`
    user-días por encima del umbral, es decir, el percentil
    (1 - alerts_per_day * N / total_filas).
    """
    n_days = scores.select(pl.col("day").n_unique()).item()
    total_rows = scores.height

    target_n_alerts = alerts_per_day * n_days
    quantile = 1.0 - (target_n_alerts / total_rows)
    # Acotar el cuantil a un rango válido por si el ratio pedido es
    # extremo (demasiado bajo o más alertas que filas totales).
    quantile = min(max(quantile, 0.0), 1.0)

    threshold = scores.select(pl.col(model).quantile(quantile, "higher")).item()
    return float(threshold)
