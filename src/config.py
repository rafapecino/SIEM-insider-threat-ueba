"""Configuración central del proyecto: rutas y constantes.

Edita DATA_DIR si mueves el dataset fuera de OneDrive (recomendado).
"""
from pathlib import Path

# Raíz del proyecto (carpeta que contiene este src/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Ruta al dataset CERT crudo.
# TODO: cuando muevas los datos fuera de OneDrive, apunta aquí, p.ej.:
#   DATA_DIR = Path(r"C:\datos\CERT\r4.2")
DATA_DIR = PROJECT_ROOT / "CERT dataset"

# Carpeta con el ground truth (answers/) del escenario r4.2
ANSWERS_DIR = DATA_DIR / "answers"

# Salidas procesadas (parquets intermedios)
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Ficheros crudos esperados del r4.2
RAW_FILES = {
    "logon": DATA_DIR / "logon.csv",
    "device": DATA_DIR / "device.csv",
    "email": DATA_DIR / "email.csv",
    "file": DATA_DIR / "file.csv",
    "http": DATA_DIR / "http.csv",        # opcional (~9 GB), fase 6
    "ldap": DATA_DIR / "LDAP",            # carpeta con CSVs mensuales
    "psychometric": DATA_DIR / "psychometric.csv",
}

# Definición de "fuera de horario" laboral (horas)
WORK_HOURS = (8, 18)
