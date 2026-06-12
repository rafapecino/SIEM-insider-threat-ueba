# Mini-SIEM / UEBA — Detección de Insider Threats (CERT r4.2)

Sistema tipo SIEM con módulo UEBA (User and Entity Behavior Analytics) que detecta
amenazas internas mediante detección de anomalías no supervisada, evaluado contra
los insiders etiquetados del dataset CERT r4.2 (CMU SEI).

Ver [PLAN.md](PLAN.md) para el plan completo de fases.

## Estructura

```
SIEM/
├── CERT dataset/          # datos crudos (NO versionado — ver .gitignore)
├── data/processed/        # parquets intermedios generados
├── notebooks/             # 01_eda, 02_features, 03_evaluacion
├── src/
│   ├── config.py          # rutas y constantes (editar DATA_DIR aquí)
│   ├── ingest/            # lectura y limpieza de CSVs
│   ├── features/          # tabla de features usuario-día
│   ├── models/            # reglas, isolation forest, autoencoder
│   └── eval/             # métricas y comparativas
├── dashboard/             # app Streamlit (SOC)
└── requirements.txt
```

## Puesta en marcha

```powershell
# 1. Entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Dependencias
pip install -r requirements.txt
```

## Dataset

Descargar `r4.2.tar.bz2` y `answers.tar.bz2` de
[KiltHub (CMU)](https://kilthub.cmu.edu/articles/dataset/Insider_Threat_Test_Dataset/12841247)
y descomprimir. Ajustar la ruta en [src/config.py](src/config.py) (`DATA_DIR`).

Recomendado: mover los datos fuera de OneDrive (p. ej. `C:\datos\CERT\r4.2`).
