"""Configuración central del proyecto: rutas y constantes.

Soporta dos entornos con autodetección:
- Google Colab: datos en Drive, carpeta MyDrive/CERT_data
- Local (Windows): datos en data/raw/r4.2 dentro del proyecto
"""
import sys
from pathlib import Path

IN_COLAB = "google.colab" in sys.modules

if IN_COLAB:
    # Requiere haber montado Drive antes:
    #   from google.colab import drive; drive.mount('/content/drive')
    DRIVE_ROOT = Path("/content/drive/MyDrive")
    DATA_DIR = DRIVE_ROOT / "CERT_data" / "r4.2"
    ANSWERS_DIR = DRIVE_ROOT / "CERT_data" / "answers"
    # Los parquets procesados se guardan en Drive para persistir entre sesiones
    PROCESSED_DIR = DRIVE_ROOT / "CERT_data" / "processed"
else:
    PROJECT_ROOT = Path(__file__).resolve().parent.parent
    DATA_DIR = PROJECT_ROOT / "data" / "raw" / "r4.2"
    ANSWERS_DIR = PROJECT_ROOT / "answers"
    PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Ficheros crudos del r4.2
RAW_FILES = {
    "logon": DATA_DIR / "logon.csv",          # id,date,user,pc,activity (Logon/Logoff)
    "device": DATA_DIR / "device.csv",        # id,date,user,pc,activity (Connect/Disconnect)
    "email": DATA_DIR / "email.csv",          # id,date,user,pc,to,cc,bcc,from,size,attachments,content
    "file": DATA_DIR / "file.csv",            # id,date,user,pc,filename,content
    "http": DATA_DIR / "http.csv",            # 14.5 GB — solo fase 6, no cargar entero
    "ldap": DATA_DIR / "LDAP",                # carpeta con snapshots mensuales (2009-12.csv ...)
    "psychometric": DATA_DIR / "psychometric.csv",  # employee_name,user_id,O,C,E,A,N
}

# Ground truth: 70 insiders de r4.2 (30 esc.1, 30 esc.2, 10 esc.3)
INSIDERS_FILE = ANSWERS_DIR / "insiders.csv"  # dataset,scenario,details,user,start,end

# Definición de "fuera de horario" laboral (horas, [inicio, fin))
WORK_HOURS = (8, 18)

# Formato de fechas en todos los CSV del dataset
DATE_FORMAT = "%m/%d/%Y %H:%M:%S"
