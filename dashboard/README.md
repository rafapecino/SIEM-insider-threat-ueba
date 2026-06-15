# Dashboard SIEM · Insider Threat UEBA

Dashboard Streamlit para explorar las alertas y watchlist generadas por los
modelos de detección de anomalías (reglas, Isolation Forest, Autoencoder)
sobre el dataset CERT r4.2.

## Requisitos previos

Tener generados los parquets de las fases 2-4 en `data/processed/`:

- `user_day_features.parquet`
- `user_day_scores.parquet`

## Cómo lanzarlo

Desde la raíz del proyecto (`SIEM/`):

```bash
pip install -r requirements.txt
streamlit run dashboard/app.py
```

Esto abrirá el dashboard en el navegador (por defecto en
`http://localhost:8501`).

## Estructura

- `data.py`: lógica de carga y cálculo (sin dependencias de Streamlit),
  testeable de forma independiente.
- `app.py`: interfaz Streamlit (watchlist, drill-down por usuario, vista
  global de distribución de scores).
