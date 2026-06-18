# 🛡️ Mini-SIEM / UEBA — Detección de Amenazas Internas

Sistema de **User and Entity Behavior Analytics (UEBA)** que detecta amenazas
internas (_insider threats_) mediante detección de anomalías no supervisada sobre
el dataset **CERT r4.2** (Carnegie Mellon SEI), con un panel SOC interactivo.

> Proyecto de investigación / portfolio. Analiza el comportamiento diario de
> ~1.000 empleados (accesos, USB, correo, ficheros) durante 17 meses y prioriza
> a quienes se desvían de su patrón normal: posibles fugas de datos, robo de
> información o cuentas comprometidas.

---

## ✨ Qué hace

- **Pipeline de features usuario-día**: convierte millones de eventos de log en una
  tabla de comportamiento por empleado y día, normalizada al estilo UEBA (z-score
  contra el propio histórico y contra el grupo de pares).
- **4 detectores especializados** que producen un _score de riesgo_ por usuario-día:
  | Detector | Enfoque | Mejor en |
  |---|---|---|
  | **Reglas** | Umbrales interpretables (USB, horario, PC ajeno) | Esc. 1 (fuga directa) |
  | **Isolation Forest** | Aislamiento de anomalías | Generalista |
  | **Autoencoder** | Error de reconstrucción del comportamiento | Esc. 2 (robo sutil) |
  | **Transformer temporal** | Secuencias / escaladas en el tiempo | Esc. 3 (sabotaje) |
- **Panel multi-detector (SOC)**: riesgo unificado, atribución automática del
  detector responsable de cada alerta, clasificación por tipo de amenaza y filtros
  por casuística.

## 📊 Resultados clave

Evaluado contra el _ground truth_ de 70 insiders reales (3 escenarios de ataque).
Detección a nivel usuario (insiders en el top-70 por riesgo):

| Detector                   | Total     | Esc. 1    | Esc. 2   | Esc. 3   |
| -------------------------- | --------- | --------- | -------- | -------- |
| Reglas                     | 36/70     | **29/30** | 1/30     | 6/10     |
| Isolation Forest           | 22/70     | 19/30     | 1/30     | 2/10     |
| Autoencoder                | 16/70     | 8/30      | **6/30** | 2/10     |
| Transformer                | 24/70     | 14/30     | 3/30     | **7/10** |
| **Unión de especialistas** | **50/70** | —         | —        | —        |

**Conclusión:** ningún modelo gana en todo — cada escenario lo cubre mejor un
detector distinto. De ahí el diseño **multi-detector**: combinar las fortalezas
en lugar de elegir un único modelo. El escenario 2 (robo camuflado en
comportamiento normal) es el más difícil y queda como línea de mejora.

> Métrica de desbalanceo: solo el 0,41 % de los usuario-día son maliciosos, por lo
> que se usa **AUC-PR / recall a presupuesto**, nunca _accuracy_.

---

## 🗂️ Estructura

```
SIEM/
├── 01_eda.ipynb           # Exploración del dataset
├── 02_features.ipynb      # Pipeline de features usuario-día → parquet
├── 03_models.ipynb        # Reglas + Isolation Forest + Autoencoder
├── 03b_transformer.ipynb  # Detector Transformer de secuencias (GPU)
├── 04_evaluacion.ipynb    # Curvas PR, alertas/día, detección por escenario
├── dashboard/
│   ├── app.py             # Panel SOC de investigación (Streamlit)
│   └── data.py            # Lógica de datos (sin Streamlit, testeable)
├── webapp/                # 🆕 Plataforma SOC web (Next.js + Supabase + Vercel)
│   ├── src/               #    Login multi-rol, cola de alertas, investigación
│   └── supabase/          #    Esquema + RLS (migraciones SQL)
├── src/config.py          # Rutas centralizadas (autodetecta Colab/local)
├── scripts/               # Utilidades (runner de notebooks, ETL a Supabase)
├── requirements.txt
├── PLAN.md                # Plan de fases del proyecto
└── CLAUDE.md              # Notas técnicas y convenciones
```

## 🚀 Puesta en marcha

### 1. Entorno

```bash
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Dataset

Descargar `r4.2.tar.bz2` y `answers.tar.bz2` de
[KiltHub (CMU)](https://kilthub.cmu.edu/articles/dataset/Insider_Threat_Test_Dataset/12841247)
y descomprimir en `data/raw/r4.2/` y `answers/`. (No se versionan — ver `.gitignore`.)

### 3. Notebooks (entrenamiento)

Pensados para **Google Colab** (el Transformer necesita GPU) o local. Ejecutar en
orden: `01 → 02 → 03 → 03b → 04`. Cada uno guarda su resultado en `data/processed/`
como Parquet, que consume el siguiente.

### 4. Dashboard (visualización)

```bash
streamlit run dashboard/app.py
```

Se abre en `http://localhost:8501`.

---

## 🧠 Enfoque técnico

- **Unidad de análisis**: usuario-día (estándar UEBA).
- **Normalización doble**: lo anómalo se define respecto a la propia normalidad del
  usuario _y_ respecto a su grupo de pares (rol/departamento).
- **No supervisado**: los modelos no usan las etiquetas; el _ground truth_ solo
  sirve para evaluar.
- **Stack**: Python · Polars · scikit-learn · PyTorch · Streamlit · Plotly.

## 🖥️ Plataforma SOC web (`webapp/`)

🔗 **En vivo: https://sentinel-ueba.vercel.app** · Cuentas demo: `analyst@soc-demo.com`
o `client@northcorp-demo.com` (contraseña `Sentinel#2026`).

Sobre el motor de detección se ha construido una **plataforma SOC funcional** estilo
MDR (Next.js + Supabase + Vercel) que cubre los puntos #2/#3/#4/#7 del roadmap:

- **Login multi-rol** (Supabase Auth): analista, administrador y cliente.
- **Cola de alertas** priorizada por el riesgo unificado, con filtros por casuística.
- **Investigación** por empleado: timeline de riesgo, "pico vs media", conductas
  destacadas, asignación, ciclo de vida del caso (nuevo → investigando → escalado/
  cerrado/falso positivo) y **notas**, todo persistido en Postgres.
- **Auditoría** ("quién investigó a quién") y **portal de cliente** de solo lectura
  (vistas que ocultan el _ground truth_ vía RLS).

Detalles, esquema y puesta en marcha en [`webapp/README.md`](webapp/README.md).

## ⚠️ Alcance y limitaciones

El motor es un **prototipo de investigación** sobre datos históricos (sin ingesta en
vivo). La plataforma web añade autenticación, persistencia y gestión de alertas, pero
no sustituye a un SIEM de producción (ingesta en tiempo real, SSO/MFA, escalado). La
hoja de ruta completa se documenta en [`docs/ROADMAP.md`](docs/ROADMAP.md).

## 📄 Licencia y datos

Código bajo licencia MIT (ver `LICENSE`). El dataset CERT pertenece a CMU SEI y se
distribuye bajo sus propios términos; no se incluye en este repositorio.

## 🙋 Autor

Rafael Pecino — proyecto académico / portfolio de ciberseguridad y machine learning.
