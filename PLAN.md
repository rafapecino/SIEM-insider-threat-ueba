# Plan de Proyecto: Mini-SIEM / UEBA para Detección de Insider Threats

**Dataset:** CERT Insider Threat r4.2 (CMU SEI)
**Objetivo:** Construir un sistema tipo SIEM con módulo UEBA que detecte amenazas internas mediante detección de anomalías no supervisada, evaluado contra los insiders reales etiquetados del dataset, con dashboard de alertas.

---

## Estado actual del dataset

| Fichero                   | Estado        | Tamaño aprox.              |
| ------------------------- | ------------- | -------------------------- |
| `email.csv`               | ✅ Disponible | 1.36 GB                    |
| `psychometric.csv`        | ✅ Disponible | 44 KB                      |
| `logon.csv`               | ❌ Falta      | ~200 MB                    |
| `device.csv`              | ❌ Falta      | ~40 MB                     |
| `file.csv`                | ❌ Falta      | ~450 MB                    |
| `http.csv`                | ❌ Falta      | ~9 GB ⚠️                   |
| LDAP (carpeta)            | ❌ Falta      | ~10 MB                     |
| `answers/` (ground truth) | ❌ Falta      | ~1 MB — **imprescindible** |

> ⚠️ **Aviso OneDrive:** la carpeta del proyecto está dentro de OneDrive. Los datos (varios GB) deben ir fuera de OneDrive (p.ej. `C:\datos\CERT\r4.2`). De hecho ya hemos perdido un fichero (PLAN.md) por la sincronización — extremar precaución.

---

## Fase 0 — Completar el dataset

- Descargar de [KiltHub (CMU)](https://kilthub.cmu.edu/articles/dataset/Insider_Threat_Test_Dataset/12841247) `r4.2.tar.bz2` y `answers.tar.bz2` (el ground truth: qué usuarios son insiders, qué escenario ejecutan y en qué fechas).
- **Decisión tomada:** empezar **sin** `http.csv` (9 GB) y añadirlo en la fase 6 si hace falta.

## Fase 1 — Exploración de datos (EDA)

- Estadísticas básicas por fuente: volumen, rango temporal (~17 meses), nº usuarios (~1.000).
- Distribución de actividad por hora/día (clave para definir "fuera de horario").
- Cruce con LDAP: roles, departamentos, bajas de empleados.
- Localizar los ~70 insiders del ground truth y entender los 3 escenarios de ataque del r4.2:
  1. Usuario que empieza a trabajar fuera de horario, usa USB y sube datos a wikileaks antes de dimitir.
  2. Usuario que navega por webs de empleo y roba propiedad intelectual antes de irse a un competidor.
  3. Administrador de sistemas descontento que instala un keylogger.
- **Entregable:** notebook `01_eda.ipynb` con conclusiones.

## Fase 2 — Ingesta y feature engineering

Pipeline en Python que transforma los CSVs crudos en una **tabla de features usuario-día**:

- **Logon:** nº logins, logins fuera de horario, nº PCs distintos, logins en PCs ajenos.
- **Device:** nº conexiones USB, conexiones USB fuera de horario.
- **File:** nº ficheros copiados, copias a USB, copias fuera de horario.
- **Email:** nº emails, emails a dominios externos, tamaño adjuntos, destinatarios fuera del círculo habitual.
- **Contexto (LDAP/psychometric):** rol, departamento, OCEAN scores.
- Normalización **por usuario** (z-score sobre su propio histórico) y **por grupo de pares** (departamento/rol) — lo que distingue un UEBA de un detector de anomalías plano.
- **Entregable:** `src/features/` + parquet con la tabla usuario-día.
- **Decisión técnica:** **Polars** (maneja el 1.36 GB de email sin dolor).

## Fase 3 — Modelos de detección

Dos enfoques no supervisados + baseline, comparados:

1. **Baseline por reglas** (SIEM clásico): umbrales sobre features. Referencia.
2. **Isolation Forest** sobre la tabla usuario-día.
3. **Autoencoder** (PyTorch): error de reconstrucción como score de anomalía.
4. _(Opcional)_ Modelo de secuencias (LSTM/Transformer tipo BERT).

Salida común: **score de riesgo por usuario-día** → agregable a score por usuario.

## Fase 4 — Evaluación

- Métricas contra ground truth: **precision, recall, F1, AUC-PR** (no accuracy: >99,9% benigno).
- Evaluación por usuario-día y por usuario.
- Métrica operativa SIEM: **alertas/día** a un umbral dado.
- Comparativa de los 3-4 modelos.
- **Entregable:** `03_evaluacion.ipynb` con tablas y curvas.

## Fase 5 — Dashboard SIEM (Streamlit)

- **Vista general:** alertas activas, timeline, top usuarios por riesgo.
- **Watchlist:** ranking de usuarios por score agregado.
- **Drill-down por usuario:** timeline, features que disparan la anomalía, comparación con su grupo.
- **Detalle de alerta:** modelo que la generó, evidencia.
- Simulación "tiempo real": replay día a día.
- **Entregable:** app `dashboard/` con `streamlit run`.

## Fase 6 — (Opcional) Extensiones

- Añadir `http.csv` como fuente.
- Modelo de secuencias tipo BERT.
- Probar con r5.2/r6.2 para discutir generalización.

---

## Stack técnico

| Componente         | Elección                  | Por qué                    |
| ------------------ | ------------------------- | -------------------------- |
| Lenguaje           | Python 3.11+              | estándar ML                |
| Procesamiento      | **Polars**                | CSVs grandes, rápido       |
| ML clásico         | scikit-learn              | Isolation Forest, métricas |
| Deep learning      | PyTorch                   | autoencoder                |
| Dashboard          | **Streamlit** + Plotly    | rápido y vistoso           |
| Formato intermedio | Parquet                   | compacto                   |
| Entorno            | venv + `requirements.txt` | reproducible               |

**Descartado (de momento):** Elasticsearch + Kibana — mucha infraestructura; Streamlit da el 90% del valor con el 10% del esfuerzo.

## Estructura de carpetas

```
SIEM/
├── CERT dataset/          # datos crudos (excluir de git y OneDrive)
├── data/processed/        # parquets intermedios
├── notebooks/             # 01_eda, 02_features, 03_evaluacion
├── src/
│   ├── config.py          # rutas centralizadas
│   ├── ingest/  features/  models/  eval/
├── dashboard/             # app Streamlit
├── PLAN.md  README.md  requirements.txt
```

## Hitos

| Hito | Resultado demostrable                                 |
| ---- | ----------------------------------------------------- |
| H0   | Dataset completo + ground truth descargado y validado |
| H1   | EDA con los 3 escenarios localizados                  |
| H2   | Tabla de features usuario-día en parquet              |
| H3   | Reglas + Isolation Forest con primera evaluación      |
| H4   | Autoencoder + comparativa de modelos                  |
| H5   | Dashboard con replay y drill-down                     |

## Decisiones tomadas

1. ✅ `http.csv` se deja para la fase 6.
2. ⏳ Mover dataset fuera de OneDrive → `C:\datos\CERT\r4.2`.
3. ⏳ Propósito (TFM/portfolio) — pendiente confirmar.
4. ✅ Git inicializado desde el inicio.
