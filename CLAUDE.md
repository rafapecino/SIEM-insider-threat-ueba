# Mini-SIEM / UEBA — Detección de Insider Threats (CERT r4.2)

Sistema tipo SIEM con módulo UEBA que detecta amenazas internas mediante detección
de anomalías no supervisada sobre el dataset CERT r4.2, evaluado contra el ground
truth de insiders etiquetados, con dashboard Streamlit estilo SOC.

**Plan completo de fases e hitos: ver [PLAN.md](PLAN.md). Léelo antes de empezar
trabajo nuevo — define qué fase toca y las decisiones ya tomadas.**

## Entornos de ejecución (¡doble!)

El proyecto se desarrolla en **dos entornos** y el código debe funcionar en ambos:

|              | Local (Windows)   | Google Colab (principal para entrenar)        |
| ------------ | ----------------- | --------------------------------------------- |
| Datos crudos | `data/raw/r4.2/`  | `/content/drive/MyDrive/CERT_data/r4.2/`      |
| Ground truth | `answers/`        | `/content/drive/MyDrive/CERT_data/answers/`   |
| Parquets     | `data/processed/` | `/content/drive/MyDrive/CERT_data/processed/` |

- `src/config.py` **autodetecta** el entorno (`IN_COLAB`) y resuelve las rutas.
  Importa SIEMPRE las rutas desde ahí — nunca hardcodear rutas en notebooks o módulos.
- En Colab, la primera celda debe montar Drive y clonar/actualizar el repo:
  ```python
  from google.colab import drive
  drive.mount('/content/drive')
  ```
- Los notebooks deben poder re-ejecutarse de cero en Colab (sesiones efímeras):
  instalar dependencias al inicio (`%pip install polars`), releer parquets de Drive.

## El dataset CERT r4.2 (verificado, no asumir otra cosa)

~1.000 empleados simulados, enero 2010 – mayo 2011. Ficheros y esquemas reales:

| Fichero            | Tamaño      | Columnas                                                            |
| ------------------ | ----------- | ------------------------------------------------------------------- |
| `logon.csv`        | 58 MB       | `id,date,user,pc,activity` (Logon/Logoff)                           |
| `device.csv`       | 29 MB       | `id,date,user,pc,activity` (Connect/Disconnect)                     |
| `email.csv`        | 1.36 GB     | `id,date,user,pc,to,cc,bcc,from,size,attachments,content`           |
| `file.csv`         | 193 MB      | `id,date,user,pc,filename,content`                                  |
| `http.csv`         | **14.5 GB** | NO usar hasta fase 6; nunca cargarlo entero en memoria              |
| `LDAP/`            | —           | snapshots mensuales `2009-12.csv`…`2011-05.csv` (org, roles, bajas) |
| `psychometric.csv` | 44 KB       | `employee_name,user_id,O,C,E,A,N` (Big Five)                        |

- Fechas en formato `MM/DD/YYYY HH:MM:SS` (constante `DATE_FORMAT` en config).
- IDs de usuario tipo `NGF0157`; emails corporativos terminan en `@dtaa.com`
  (todo lo demás es dominio externo — señal clave para exfiltración).
- `email.csv` mezcla cuentas corporativas y personales en `from`.

### Ground truth (`answers/insiders.csv`)

`dataset,scenario,details,user,start,end` — filtrar `dataset == "4.2"`.
⚠️ **Gotcha verificado**: leer con `schema_overrides={"dataset": pl.Utf8}` — si no,
Polars infiere la columna como float (valores 2, 3.1, 4.2…) y el filtro string falla.

**70 insiders en r4.2**: 30 escenario 1, 30 escenario 2, 10 escenario 3:

1. **Fuga a wikileaks**: usuario sin historial de USB ni horario nocturno empieza
   a entrar fuera de horario, usar USB y subir datos a wikileaks.org. Dimite poco después.
2. **Robo para competidor**: navega webs de empleo, contacta competidor, y roba
   datos por USB a ritmo muy superior a su histórico antes de irse.
3. **Sysadmin keylogger**: administrador descontento instala keylogger en el PC de
   su supervisor vía USB, usa las credenciales capturadas para enviar un mass email
   alarmante, y abandona la organización.

Los subdirectorios `answers/r4.2-1/2/3/` contienen los observables detallados por
incidente (NO son CSV bien formados — filas de longitud variable con tipo en col. 1).

- El desbalanceo es extremo (>99.9% benigno). **Nunca usar accuracy**; usar
  precision/recall/F1/AUC-PR y "alertas/día" como métrica operativa.

### Hechos verificados contra los datos (smoke test, no re-derivar)

- `logon.csv`: 854.859 eventos, **1.000 usuarios**, 2010-01-02 → 2011-05-17.
- `device.csv`: 405.380 eventos; solo **265/1000 usuarios usan USB** — el uso de
  USB en sí ya es discriminativo.
- LDAP: 18 snapshots; columnas `employee_name,user_id,email,role,business_unit,
functional_unit,department,team,supervisor`.
- **155 bajas** en el periodo y los **70 insiders están todos entre las bajas** —
  la baja es consecuencia de los escenarios (señal fuerte, pero solo visible a
  posteriori: no usarla como feature predictiva en tiempo real, sí para validar).

## Arquitectura

```
SIEM/
├── answers/               # ground truth (insiders.csv, scenarios.txt) — NO en git
├── data/raw/r4.2/         # CSVs crudos — NO en git
├── data/processed/        # parquets intermedios — NO en git
├── notebooks/             # 01_eda, 02_features, 03_evaluacion (ejecutables en Colab)
├── src/
│   ├── config.py          # ÚNICA fuente de rutas/constantes (autodetecta Colab)
│   ├── ingest/            # lectura+limpieza CSV → parquet tipado
│   ├── features/          # tabla usuario-día + normalización (z-score propio y de pares)
│   ├── models/            # baseline reglas, isolation forest, autoencoder
│   └── eval/              # métricas contra ground truth, comparativas
├── dashboard/             # app Streamlit estilo SOC
└── PLAN.md                # plan de fases — consultar siempre
```

Flujo de datos: `CSV crudo → (ingest) → parquet eventos → (features) → parquet
usuario-día → (models) → scores → (eval / dashboard)`.

## Convenciones de código

- **Polars** para todo el procesamiento de datos (no pandas, salvo interoperabilidad
  con scikit-learn/plotly al final del pipeline). Usar `scan_csv`/lazy frames para
  los ficheros grandes.
- La unidad de análisis es **usuario-día**. Toda feature nueva se agrega a ese nivel.
- Normalización doble: z-score contra el **histórico del propio usuario** y contra
  su **grupo de pares** (rol/departamento de LDAP). Es la esencia del UEBA.
- Los modelos producen un **score de riesgo por usuario-día** con interfaz común,
  para que eval y dashboard los traten de forma intercambiable.
- Resultados intermedios siempre en **Parquet** en `PROCESSED_DIR`.
- Comentarios y docs en español; nombres de código (funciones, variables) en inglés.
- Python 3.11+. Entorno local: `.venv` + `pip install -r requirements.txt`.

## Precauciones

- `http.csv` (14.5 GB): no tocarlo hasta la fase 6, y entonces solo vía
  `pl.scan_csv` con filtros pushdown. En Drive gratuito (15 GB) probablemente
  ni quepa — no subirlo a CERT_data salvo decisión explícita.
- No commitear datos: `.gitignore` excluye `*.csv`, `answers/`, `data/`.
- El repo git vive en `C:\Users\rafap\Desktop\SIEM` (la ruta vieja de OneDrive
  está muerta — no usar).
