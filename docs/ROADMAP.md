# Hoja de ruta: de prototipo a SIEM de producción

Este documento responde a una auditoría sobre qué falta para que el prototipo sea
un SIEM operativo. Para cada punto: **viabilidad** y **esfuerzo estimado**.

**Escala de esfuerzo** (orientativa, 1 desarrollador):
`S` = horas–2 días · `M` = días–1 semana · `L` = semanas · `XL` = meses / equipo.

> Contexto: el proyecto es un **prototipo de investigación** sobre datos históricos.
> La mayoría de los puntos "críticos" no son _bugs_, sino la construcción del
> producto/infraestructura alrededor del motor de detección (que ya existe y
> funciona). Por eso varios son XL: equivalen a "construir un SIEM real".

---

## 🔴 Críticos — bloqueantes para producción

| #   | Punto                                                                 | ¿Viable? | Esfuerzo | Notas                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Ingesta en tiempo real** (Syslog/CEF, Kafka, conectores AD/EDR/DLP) | Sí       | **XL**   | Es la capa de ingesta de un SIEM entero. Versión de portfolio asequible: un consumidor Kafka / `tail` de fichero que alimente el pipeline de features en streaming (**L**). Conectores comerciales (Splunk/QRadar) → XL. |
| 2   | **Autenticación + RBAC** (MFA, SSO, roles Tier 1/2/3)                 | Sí       | **L**    | Login básico con `streamlit-authenticator` o Auth0 (**M**). SSO/SAML/LDAP corporativo + MFA + roles → **L**.                                                                                                             |
| 3   | **Gestión de alertas / ticketing** (ciclo de vida, asignación)        | Sí       | **L**    | Estado de alerta + asignación + cierre en BD (**M**). Integrar TheHive/JIRA/ServiceNow → **L**.                                                                                                                          |
| 4   | **Persistencia real** (PostgreSQL/Elastic/ClickHouse)                 | Sí       | **M**    | Migrar parquets → BD; tablas de alertas, investigaciones y modelos. Técnicamente directo.                                                                                                                                |

## 🟠 Importantes — operación SOC real

| #   | Punto                                                        | ¿Viable? | Esfuerzo          | Notas                                                                                                                                |
| --- | ------------------------------------------------------------ | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 5   | **Notificaciones push** (email/Slack/Teams/PagerDuty)        | Sí       | **S–M**           | De lo más rentable: webhook/SMTP al superar umbral. Empezar por aquí.                                                                |
| 6   | **Feedback de falsos positivos + reentrenamiento**           | Sí       | **M–L**           | Botón "marcar FP" + persistir etiqueta (**M**). Reentrenamiento automático (MLOps) → **L**.                                          |
| 7   | **Auditoría del propio SIEM** (quién investigó a quién)      | Sí       | **S–M**           | Registrar acciones de usuario en BD. Necesario para GDPR/ISO 27001/SOC2.                                                             |
| 8   | **Retención de datos + privacidad** (GDPR)                   | Parcial  | **S–M** (técnico) | El borrado/retención configurable es **S–M**. El grueso es **legal/organizativo** (consentimiento, base legal, DPIA) — no es código. |
| 9   | **Informes formales** (PDF diario/semanal, compliance, CISO) | Sí       | **M**             | Generación PDF programada (`reportlab`/`weasyprint`) + plantillas.                                                                   |

## 🟡 Calidad profesional

| #   | Punto                                                     | ¿Viable? | Esfuerzo | Notas                                                                                                                                                                     |
| --- | --------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | **Quitar modo demo y botón Deploy en producción**         | Sí       | **S**    | _Quick win_: flag de configuración para ocultar el ground truth; ocultar la toolbar de Streamlit.                                                                         |
| 11  | **Escalabilidad** (backend/frontend, Redis, Gunicorn)     | Sí       | **L–XL** | Streamlit no escala a muchos analistas. Caché Redis + workers (**M**); separar FastAPI + React (**L–XL**).                                                                |
| 12  | **API REST documentada** (OpenAPI/Swagger, tokens)        | Sí       | **M**    | Envoltorio FastAPI exponiendo scores/alertas con auth por token y rate limiting.                                                                                          |
| 13  | **Más vectores de amenaza** (red, SaaS, VPN, privilegios) | Parcial  | **S–XL** | Limitado por el dataset. Añadir **navegación web** (`http.csv`, ya disponible) es **S–M**. Otros vectores requieren fuentes de datos nuevas → depende de la ingesta (#1). |
| 14  | **Explicabilidad (XAI)** (SHAP, importancia por alerta)   | Sí       | **M**    | Para el autoencoder, el error de reconstrucción **por feature** ya da explicabilidad barata (**S–M**). SHAP completo para todos los modelos → **M–L**.                    |
| 15  | **Tests, CI/CD, documentación de arquitectura**           | Sí       | **M**    | `data.py` ya es testeable. Añadir `pytest` (unidad + pipeline), GitHub Actions y un diagrama de arquitectura.                                                             |

---

## Recomendación de priorización (para portfolio/TFM)

Mayor valor demostrable por menor esfuerzo — **empezar por aquí**:

1. **#10** quitar demo/Deploy (**S**) — profesionaliza la demo al instante.
2. **#15** tests + CI/CD (**M**) — señal fuerte de ingeniería seria.
3. **#5** notificaciones (**S–M**) — convierte el panel en algo "vivo".
4. **#14** explicabilidad por feature (**S–M**) — refuerza la vista de investigación.
5. **#9** informe PDF (**M**) — entregable tangible para un CISO ficticio.
6. **#4 + #7** BD + auditoría (**M**) — base para todo lo demás.

Lo verdaderamente **XL** (#1 ingesta real, #11 rearquitectura) es "construir un
producto", fuera del alcance de un prototipo académico — pero se menciona como
trabajo futuro para enmarcar correctamente el alcance.
