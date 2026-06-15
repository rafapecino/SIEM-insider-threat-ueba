"""Dashboard SIEM/UEBA — panel multi-detector de amenazas internas (CERT r4.2).

Centro de operaciones de seguridad (SOC) interactivo: combina 4 detectores
especializados en un riesgo unificado, atribuye cada alerta al detector
responsable, clasifica la conducta por tipo de amenaza y permite filtrar
por casuística.

Ejecutar desde la raíz del proyecto:
    streamlit run dashboard/app.py
"""
import polars as pl
import plotly.graph_objects as go
import streamlit as st

from dashboard import data

# ---------------------------------------------------------------------------
# Configuración de página y estilo
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="SOC · Amenazas internas",
    page_icon="🛡️",
    layout="wide",
)

st.markdown(
    """
    <style>
      .block-container { padding-top: 1.6rem; max-width: 1300px; }
      #MainMenu, footer { visibility: hidden; }

      div[data-testid="stMetric"] {
        background: rgba(130,140,160,0.08);
        border: 1px solid rgba(130,140,160,0.18);
        border-radius: 12px; padding: 12px 16px;
      }
      .kpi-sub { font-size: 0.78rem; color: #888; margin-top: -6px; }
      .kpi-val { font-size: 1.6rem; font-weight: 700; }

      .verdict {
        border-radius: 12px; padding: 16px 20px; margin: 6px 0 14px 0;
        color: #fff; font-size: 1.02rem;
      }
      .reason {
        background: rgba(130,140,160,0.08);
        border-left: 4px solid #f08c00; border-radius: 6px;
        padding: 8px 12px; margin: 6px 0;
      }
      .badge {
        display:inline-block; padding:2px 10px; border-radius:999px;
        font-size:0.82rem; font-weight:600; color:#fff;
      }
      .det-badge {
        display:inline-block; padding:4px 12px; border-radius:8px;
        font-size:0.9rem; font-weight:600; color:#fff; background:#4c6ef5;
        margin-bottom: 4px;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

# Paleta sobria
RED, AMBER, GREEN, BLUE = "#e03131", "#f08c00", "#2f9e44", "#4c6ef5"
RISK_BADGE = {"Alto": ("🔴", RED), "Medio": ("🟠", AMBER), "Bajo": ("🟢", GREEN)}


def risk_verdict(risk_pct: float, threshold_pct: float, p95_pct: float = 0.95) -> str:
    """Nivel de riesgo (Alto/Medio/Bajo) para un valor de `risk` (0-100)."""
    r = risk_pct / 100.0
    if r >= threshold_pct:
        return "Alto"
    if r >= p95_pct:
        return "Medio"
    return "Bajo"


# ---------------------------------------------------------------------------
# Carga de datos (cacheada): scores + features, riesgo unificado y casuística
# ---------------------------------------------------------------------------
@st.cache_data
def load_enriched():
    scores = data.load_scores()
    features = data.load_features()

    scores_enriched = data.add_unified_risk(scores)

    threats = data.classify_threats(features)
    threats = threats.join(
        features.select("user", "day", "role", "department"),
        on=["user", "day"], how="left",
    )
    scores_enriched = scores_enriched.join(
        threats.select("user", "day", "threat_type"),
        on=["user", "day"], how="left",
    )

    return scores_enriched, features, threats


with st.spinner("Calculando riesgo…"):
    scores_enriched, features, threats = load_enriched()


# ---------------------------------------------------------------------------
# Barra lateral
# ---------------------------------------------------------------------------
st.sidebar.title("🛡️ Centro de seguridad")
st.sidebar.caption("Panel multi-detector de amenazas internas (UEBA)")

st.sidebar.markdown("### 🎚️ Detección")

sensitivity = st.sidebar.select_slider(
    "Sensibilidad",
    options=["Baja", "Media", "Alta"],
    value="Media",
    help=(
        "Cuántas alertas genera el sistema al día. Más sensibilidad = más "
        "alertas (se escapan menos amenazas, pero hay más falsas alarmas)."
    ),
)
ALERTS_TARGET = {"Baja": 5.0, "Media": 10.0, "Alta": 20.0}[sensitivity]
risk_threshold = data.threshold_for_alert_rate(scores_enriched, "risk", ALERTS_TARGET)

_summary = data.alerts_summary(scores_enriched, risk_threshold)
st.sidebar.caption(
    f"≈ {_summary['alerts_per_day']:.0f} alertas/día · "
    f"{_summary['recall']:.0%} de amenazas detectadas"
)

st.sidebar.markdown("### 🔬 Filtros (casuística)")

threat_filter = st.sidebar.multiselect(
    "Tipo de amenaza",
    options=data.THREAT_TYPES,
    default=[],
    help="Filtra por la conducta dominante del día más anómalo de cada empleado.",
)

dept_options = sorted(
    features.select("department").drop_nulls().unique().to_series().to_list()
)
dept_filter = st.sidebar.multiselect("Departamento", options=dept_options, default=[])

st.sidebar.markdown("### 🧪 Modo demostración")
show_labels = st.sidebar.toggle("Activar", value=True)
st.sidebar.caption(
    "Resalta los empleados que sabemos fueron una amenaza real (ground truth), "
    "para validar si el panel acierta. En un caso real no se conoce de antemano."
)

scenario_filter = None
if show_labels:
    scenario_options = {0: "Todos", 1: "Esc.1", 2: "Esc.2", 3: "Esc.3"}
    scen_sel = st.sidebar.selectbox(
        "Escenario (solo demo)",
        options=list(scenario_options.keys()),
        format_func=lambda k: scenario_options[k],
    )
    if scen_sel != 0:
        scenario_filter = scen_sel

st.sidebar.markdown("---")
st.sidebar.caption(
    "Datos: **CERT r4.2** · 1.000 empleados · 17 meses de actividad "
    "(accesos, USB, correo, ficheros). 4 detectores especializados."
)


# ---------------------------------------------------------------------------
# Watchlist filtrada
# ---------------------------------------------------------------------------
filters = {"risk_min": risk_threshold}
if threat_filter:
    filters["threat_type"] = threat_filter
if dept_filter:
    filters["department"] = dept_filter
if scenario_filter is not None:
    filters["scenario"] = scenario_filter

watchlist = data.risk_watchlist(scores_enriched, threats, top_n=50, filters=filters)
wl = watchlist.to_pandas()

n_flagged = wl["user"].nunique() if not wl.empty else 0


# ---------------------------------------------------------------------------
# Encabezado compacto
# ---------------------------------------------------------------------------
st.markdown("## 🛡️ SOC · Panel multi-detector de amenazas internas")
st.caption(
    "Cada usuario-día recibe el riesgo MÁXIMO entre 4 detectores especializados; "
    "la alerta se atribuye al detector responsable y se clasifica por tipo de amenaza."
)

tab_alertas, tab_investigar, tab_rendimiento = st.tabs(
    ["🛡️ Centro de alertas", "🔍 Investigar empleado", "📈 Rendimiento"]
)


# ===========================================================================
# KPIs superiores
# ===========================================================================
def kpi_html(value: str, sub: str, color: str | None = None) -> str:
    style = f"color:{color};" if color else ""
    return (
        f'<div class="kpi-val" style="{style}">{value}</div>'
        f'<div class="kpi-sub">{sub}</div>'
    )


c1, c2, c3, c4 = st.columns(4)

with c1:
    st.metric("Empleados en alerta", n_flagged, help="Riesgo por encima del umbral.")
    st.markdown(kpi_html("", "riesgo por encima del umbral"), unsafe_allow_html=True)

with c2:
    st.metric(
        "Alertas al día", f"{_summary['alerts_per_day']:.0f}",
        help="Carga de trabajo para el equipo SOC.",
    )
    st.markdown(kpi_html("", "carga para el equipo SOC"), unsafe_allow_html=True)

with c3:
    if show_labels:
        n_detected = int(_summary["recall"] * 70)
        color = GREEN if n_detected >= 45 else (AMBER if n_detected >= 30 else RED)
        st.metric("Amenazas detectadas", f"{n_detected}/70")
        st.markdown(
            kpi_html("", "insiders reales en la watchlist", color),
            unsafe_allow_html=True,
        )
    else:
        st.metric("Detectores activos", len(data.MODELS))
        st.markdown(kpi_html("", "especialistas combinados"), unsafe_allow_html=True)

with c4:
    prec = _summary["precision"]
    color = GREEN if prec >= 0.10 else (AMBER if prec >= 0.03 else RED)
    st.metric("Precisión", f"{prec:.1%}")
    st.markdown(
        kpi_html("", "de alertas son reales (típico en UEBA: bajo)", color),
        unsafe_allow_html=True,
    )


# ===========================================================================
# PESTAÑA 1 · CENTRO DE ALERTAS
# ===========================================================================
with tab_alertas:
    if wl.empty:
        st.info("No hay empleados que cumplan los filtros seleccionados.")
    else:
        wl_show = wl.copy()
        wl_show["nivel"] = wl_show["risk"].apply(
            lambda r: risk_verdict(r, risk_threshold)
        )
        wl_show["Riesgo"] = wl_show.apply(
            lambda r: f"{RISK_BADGE[r['nivel']][0]} {r['risk']:.1f}", axis=1
        )
        wl_show["Detectado por"] = wl_show["detector"].apply(
            lambda d: f"{d}"
        )
        wl_show["Día más anómalo"] = wl_show["peak_day"].astype(str)

        display_cols = {
            "user": "Empleado",
            "Riesgo": "Riesgo",
            "Detectado por": "Detectado por",
            "threat_type": "Tipo de amenaza",
            "Día más anómalo": "Día más anómalo",
            "department": "Departamento",
        }

        if show_labels:
            wl_show["¿Amenaza real?"] = wl_show["is_insider_user"].map(
                {True: "🔴 Sí", False: "⚪ No"}
            )
            wl_show["Escenario"] = wl_show["scenario"].apply(data.scenario_name)
            display_cols["¿Amenaza real?"] = "¿Amenaza real?"
            display_cols["Escenario"] = "Escenario"

        table = wl_show[list(display_cols.keys())].rename(columns=display_cols)

        st.caption(
            "Pulsa una fila para investigar a ese empleado en la pestaña "
            "'Investigar empleado'."
        )

        selected_user = None
        try:
            event = st.dataframe(
                table,
                use_container_width=True,
                hide_index=True,
                on_select="rerun",
                selection_mode="single-row",
            )
            rows = event.selection.get("rows", []) if hasattr(event, "selection") else []
            if rows:
                selected_user = wl_show.iloc[rows[0]]["user"]
        except TypeError:
            # Fallback: versión de Streamlit sin soporte de on_select.
            st.dataframe(table, use_container_width=True, hide_index=True)
            selected_user = st.selectbox(
                "Elegir empleado para investigar",
                options=wl_show["user"].tolist(),
            )

        if selected_user:
            st.session_state["selected_user"] = selected_user

        st.caption(
            "**Detectado por**: especialista responsable de la alerta. "
            + " · ".join(
                f"{name} → {data.MODEL_SPECIALTY[key]}"
                for key, name in data.MODELS.items()
            )
        )

        csv_bytes = wl_show[list(display_cols.keys())].rename(
            columns=display_cols
        ).to_csv(index=False).encode("utf-8")
        st.download_button(
            "⬇️ Exportar a CSV",
            data=csv_bytes,
            file_name="watchlist_soc.csv",
            mime="text/csv",
        )


# ===========================================================================
# PESTAÑA 2 · INVESTIGAR EMPLEADO
# ===========================================================================
with tab_investigar:
    if wl.empty:
        st.info("No hay empleados que cumplan los filtros seleccionados.")
    else:
        users = wl["user"].tolist()
        default_user = st.session_state.get("selected_user")
        default_idx = users.index(default_user) if default_user in users else 0

        selected_user = st.selectbox(
            "Elige un empleado para investigar",
            options=users,
            index=default_idx,
            help="La lista contiene los empleados de mayor riesgo (según filtros).",
        )

        if selected_user:
            urow = wl[wl["user"] == selected_user].iloc[0]
            risk_val = float(urow["risk"])
            band = risk_verdict(risk_val, risk_threshold)
            color = data.RISK_COLORS[band]
            peak_day = urow["peak_day"]
            detector_key = next(
                (k for k, v in data.MODELS.items() if v == urow["detector"]),
                "score_rules",
            )

            role = urow["role"] or "—"
            dept = urow["department"] or "—"

            # Resumen automático
            reasons = data.explain_user_day(features, selected_user, peak_day, top_n=5)
            if reasons:
                motivos_txt = ", ".join(
                    f"{r['label']} ({r['value']:.0f} vs media {r['avg']:.2f})"
                    for r in reasons
                )
            else:
                motivos_txt = "sin conductas destacadas por encima de su media"

            resumen = (
                f"<b>{selected_user}</b> ({role}, {dept}) alcanzó su pico de riesgo "
                f"el <b>{peak_day}</b> ({risk_val:.1f}/100), detectado por "
                f"<b>{urow['detector']}</b>. Conductas destacadas: {motivos_txt}."
            )
            st.markdown(
                f'<div class="verdict" style="background:{color}">{resumen}</div>',
                unsafe_allow_html=True,
            )

            # Badge detector
            st.markdown(
                f'<span class="det-badge">🔬 Detectado por: {urow["detector"]} — '
                f'{data.MODEL_SPECIALTY[detector_key]}</span>',
                unsafe_allow_html=True,
            )

            if show_labels and bool(urow["is_insider_user"]):
                st.warning(
                    f"⚠️ **Modo demostración:** este empleado fue una amenaza real "
                    f"({data.scenario_name(urow['scenario'])})."
                )

            # Evolución temporal del riesgo unificado
            st.markdown("#### Evolución del riesgo unificado")
            user_risk = (
                scores_enriched.filter(pl.col("user") == selected_user)
                .select(
                    "day",
                    (pl.col("risk") * 100).alias("risk"),
                    "label_malicious_day",
                )
                .sort("day")
                .to_pandas()
            )
            fig = go.Figure()
            fig.add_trace(
                go.Scatter(
                    x=user_risk["day"], y=user_risk["risk"], mode="lines",
                    name="Riesgo unificado", line=dict(color=BLUE),
                )
            )
            fig.add_hline(
                y=risk_threshold * 100, line_dash="dash", line_color=AMBER,
                annotation_text="Umbral de alerta", annotation_position="top left",
            )
            if show_labels:
                mal = user_risk[user_risk["label_malicious_day"] == 1]
                if not mal.empty:
                    fig.add_trace(
                        go.Scatter(
                            x=mal["day"], y=mal["risk"], mode="markers",
                            name="Día de amenaza real",
                            marker=dict(color=RED, size=11, symbol="x"),
                        )
                    )
            fig.update_layout(
                height=340, margin=dict(t=10, b=10),
                xaxis_title="Fecha", yaxis_title="Riesgo (0-100)",
                legend=dict(orientation="h", y=1.15),
            )
            st.plotly_chart(fig, use_container_width=True)

            # Peor día vs media
            st.markdown("#### Su peor día frente a su rutina normal")
            peak = features.filter(
                (pl.col("user") == selected_user) & (pl.col("day") == peak_day)
            ).select(data.SUSPICIOUS_FEATURES)
            if peak.height:
                means = features.filter(pl.col("user") == selected_user).select(
                    [pl.col(f).mean().alias(f) for f in data.SUSPICIOUS_FEATURES]
                )
                labels = [data.FEATURE_LABELS[f] for f in data.SUSPICIOUS_FEATURES]
                peak_vals = [float(peak[f][0]) for f in data.SUSPICIOUS_FEATURES]
                mean_vals = [float(means[f][0]) for f in data.SUSPICIOUS_FEATURES]
                figb = go.Figure()
                figb.add_trace(go.Bar(
                    y=labels, x=mean_vals, name="Su media diaria",
                    orientation="h", marker_color="#adb5bd",
                ))
                figb.add_trace(go.Bar(
                    y=labels, x=peak_vals, name="Día más anómalo",
                    orientation="h", marker_color=RED,
                ))
                figb.update_layout(
                    barmode="group", height=340, margin=dict(t=10, b=10),
                    xaxis_title="Nº de veces ese día",
                    legend=dict(orientation="h", y=1.15),
                )
                st.plotly_chart(figb, use_container_width=True)

            # Días de mayor riesgo
            st.markdown("#### Días de mayor riesgo")
            top_days = (
                scores_enriched.filter(pl.col("user") == selected_user)
                .select("day", (pl.col("risk") * 100).round(1).alias("risk"), "detector")
                .sort("risk", descending=True)
                .head(5)
                .with_columns(pl.col("detector").replace(data.MODELS))
                .to_pandas()
            )
            top_days["day"] = top_days["day"].astype(str)
            top_days = top_days.rename(
                columns={"day": "Día", "risk": "Riesgo", "detector": "Detectado por"}
            )
            st.dataframe(top_days, use_container_width=True, hide_index=True)


# ===========================================================================
# PESTAÑA 3 · RENDIMIENTO
# ===========================================================================
with tab_rendimiento:
    st.markdown("#### Por qué un panel multi-detector")
    st.markdown(
        "Fundir los 4 detectores en un único score no mejora al mejor especialista "
        "solo. Sin embargo, **cada detector cubre mejor un tipo de amenaza distinto**: "
        "el de Reglas detecta accesos fuera de horario y USB; el Autoencoder, "
        "desviaciones sutiles; el Transformer, escaladas en el tiempo; e Isolation "
        "Forest actúa como generalista. Mostrando los 4 y atribuyendo cada alerta "
        "al especialista responsable, la **unión de detectores cubre muchas más "
        "amenazas reales** que cualquiera por separado."
    )

    if show_labels:
        st.markdown("#### Comparativa de detectores (misma carga de trabajo)")
        rows = []
        for mk, mname in data.MODELS.items():
            thr = data.threshold_for_alert_rate(scores_enriched, mk, ALERTS_TARGET)
            s = data.alerts_at_threshold(scores_enriched, mk, thr)
            rows.append({
                "Detector": mname,
                "Especialidad": data.MODEL_SPECIALTY[mk],
                "Aciertos (recall)": f"{s['recall']:.0%}",
                "Precisión": f"{s['precision']:.1%}",
            })
        st.dataframe(rows, use_container_width=True, hide_index=True)
    else:
        st.info("Activa el **modo demostración** para ver la comparativa de detectores.")

    st.markdown("#### Distribución del riesgo unificado")
    risk_vals = (scores_enriched.select((pl.col("risk") * 100).alias("risk"))
                  .to_pandas())
    fig_h = go.Figure()
    fig_h.add_trace(go.Histogram(x=risk_vals["risk"], nbinsx=100, marker_color=BLUE))
    fig_h.add_vline(
        x=risk_threshold * 100, line_dash="dash", line_color=AMBER,
        annotation_text="Umbral de alerta",
    )
    fig_h.update_layout(
        height=340, margin=dict(t=10, b=10),
        xaxis_title="Riesgo unificado (0-100)",
        yaxis_title="Frecuencia (escala log)",
        yaxis_type="log",
    )
    st.plotly_chart(fig_h, use_container_width=True)
    st.caption(
        "Casi todos los usuario-día son normales (pico a la izquierda); solo una "
        "pequeña cola a la derecha es anómala. El umbral decide a partir de "
        "dónde se genera una alerta: ajústalo con la *Sensibilidad*."
    )
