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
    "score_rules": "Reglas (baseline)",
    "score_iforest": "Isolation Forest",
    "score_autoencoder": "Autoencoder",
}

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
