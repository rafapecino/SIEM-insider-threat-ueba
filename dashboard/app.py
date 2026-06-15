"""Dashboard SIEM/UEBA — detección de amenazas internas (CERT r4.2).

Centro de operaciones de seguridad (SOC) interactivo: prioriza usuarios por
riesgo, explica en lenguaje llano por qué cada uno es sospechoso, y permite
ajustar la sensibilidad de la detección.

Ejecutar desde la raíz del proyecto:
    streamlit run dashboard/app.py
"""
import pandas as pd
import plotly.graph_objects as go
import polars as pl
import streamlit as st

from dashboard import data

# ---------------------------------------------------------------------------
# Configuración de página y estilo
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="SOC · Detección de amenazas internas",
    page_icon="🛡️",
    layout="wide",
)

st.markdown(
    """
    <style>
      .block-container { padding-top: 2.2rem; max-width: 1300px; }
      #MainMenu, footer { visibility: hidden; }
      div[data-testid="stMetric"] {
        background: rgba(130,140,160,0.08);
        border: 1px solid rgba(130,140,160,0.18);
        border-radius: 12px; padding: 14px 16px;
      }
      .verdict {
        border-radius: 12px; padding: 18px 22px; margin: 6px 0 14px 0;
        color: #fff; font-size: 1.05rem;
      }
      .pill {
        display:inline-block; padding:2px 10px; border-radius:999px;
        font-size:0.8rem; font-weight:600; color:#fff;
      }
      .reason {
        background: rgba(130,140,160,0.08);
        border-left: 4px solid #f08c00; border-radius: 6px;
        padding: 8px 12px; margin: 6px 0;
      }
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------------------
# Carga de datos (cacheada)
# ---------------------------------------------------------------------------
@st.cache_data
def get_scores():
    return data.load_scores()


@st.cache_data
def get_features():
    return data.load_features()


scores = get_scores()
features = get_features()


# ---------------------------------------------------------------------------
# Barra lateral: controles en lenguaje llano
# ---------------------------------------------------------------------------
st.sidebar.title("🛡️ Centro de seguridad")
st.sidebar.caption("Detección de empleados con comportamiento anómalo (UEBA)")

st.sidebar.markdown("### Ajustes")

model_key = st.sidebar.selectbox(
    "Método de detección",
    options=list(data.MODELS.keys()),
    format_func=lambda k: data.MODELS[k],
    help=(
        "Cómo se calcula el riesgo. 'Reglas' es transparente y explicable; "
        "'Isolation Forest' y 'Autoencoder' aprenden patrones automáticamente."
    ),
)

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
threshold = data.threshold_for_alert_rate(scores, model_key, ALERTS_TARGET)
p95 = data.score_p95(scores, model_key)

show_labels = st.sidebar.toggle("Modo demostración", value=True)
st.sidebar.caption(
    "Activado: se resaltan los empleados que sabemos que fueron una amenaza "
    "real, para comprobar si el sistema acierta. En un caso real no se conoce "
    "esta información de antemano."
)

st.sidebar.markdown("---")
st.sidebar.caption(
    "Datos: **CERT r4.2** · 1.000 empleados · 17 meses de actividad "
    "(accesos, USB, correo, ficheros)."
)


# ---------------------------------------------------------------------------
# Cálculos compartidos
# ---------------------------------------------------------------------------
alert_stats = data.alerts_at_threshold(scores, model_key, threshold)
watchlist = data.user_watchlist(scores, model_key, top_n=50)

# Nivel de riesgo por usuario de la watchlist
wl = watchlist.to_pandas()
wl["Riesgo"] = wl["max_score"].apply(lambda s: data.risk_band(s, threshold, p95))
n_flagged = int((wl["max_score"] >= threshold).sum())


# ---------------------------------------------------------------------------
# Encabezado
# ---------------------------------------------------------------------------
st.title("Detección de amenazas internas")
st.caption(
    "Este panel analiza el comportamiento diario de cada empleado y señala a "
    "quienes se desvían de lo normal: posibles fugas de información, robo de "
    "datos o cuentas comprometidas."
)

tab_resumen, tab_investigar, tab_modelo = st.tabs(
    ["🏠  Resumen", "🔍  Investigar empleado", "📈  Rendimiento del método"]
)


# ===========================================================================
# PESTAÑA 1 · RESUMEN
# ===========================================================================
with tab_resumen:
    st.markdown("#### Situación actual")

    c = st.columns(4)
    c[0].metric("Empleados vigilados", "1.000")
    c[1].metric(
        "En alerta",
        n_flagged,
        help="Empleados cuyo día más anómalo supera el umbral de alerta.",
    )
    c[2].metric(
        "Alertas al día",
        f"{alert_stats['alerts_per_day']:.0f}",
        help="Volumen de trabajo para el equipo de seguridad.",
    )
    if show_labels:
        c[3].metric(
            "Amenazas detectadas",
            f"{int(alert_stats['recall'] * 70)} / 70",
            help="De las 70 amenazas reales del dataset, cuántas se detectan.",
        )
    else:
        c[3].metric("Método", data.MODELS[model_key])

    with st.expander("❓ ¿Cómo leo esta página?"):
        st.markdown(
            """
            - Cada empleado recibe un **nivel de riesgo** según lo anómalo que
              fue su peor día: 🔴 **Alto** (revisar), 🟠 **Medio** (vigilar),
              🟢 **Bajo** (normal).
            - La lista de abajo está **ordenada por riesgo**: arriba, lo primero
              que debería mirar un analista.
            - Pulsa en la pestaña **Investigar empleado** para ver el detalle y
              el *porqué* de cada caso.
            - Ajusta la **Sensibilidad** en la barra lateral para generar más o
              menos alertas.
            """
        )

    st.markdown("#### 🚩 Empleados a revisar (mayor riesgo primero)")

    # Motivo principal de cada empleado mostrado
    top_show = wl.head(25).copy()
    motivos = []
    for _, r in top_show.iterrows():
        reasons = data.explain_user_day(features, r["user"], r["peak_day"], top_n=1)
        motivos.append(reasons[0]["label"] if reasons else "—")
    top_show["Motivo principal"] = motivos

    emoji = {"Alto": "🔴", "Medio": "🟠", "Bajo": "🟢"}
    top_show["Nivel"] = top_show["Riesgo"].map(lambda x: f"{emoji[x]} {x}")

    display_cols = {
        "user": "Empleado",
        "Nivel": "Riesgo",
        "peak_day": "Día más anómalo",
        "Motivo principal": "Motivo principal",
    }
    if show_labels:
        top_show["Real"] = top_show["is_insider_user"].map(
            {True: "⚠️ Amenaza real", False: "—"}
        )
        display_cols["Real"] = "¿Era amenaza real?"

    st.dataframe(
        top_show[list(display_cols.keys())].rename(columns=display_cols),
        use_container_width=True,
        hide_index=True,
    )
    if show_labels:
        st.caption(
            "La columna *¿Era amenaza real?* solo aparece en modo demostración: "
            "permite ver de un vistazo cuántos de los señalados eran de verdad "
            "una amenaza."
        )


# ===========================================================================
# PESTAÑA 2 · INVESTIGAR EMPLEADO
# ===========================================================================
with tab_investigar:
    users = wl["user"].tolist()
    selected_user = st.selectbox(
        "Elige un empleado para investigar",
        options=users,
        index=0,
        help="La lista contiene los 50 empleados de mayor riesgo.",
    )

    if selected_user:
        urow = wl[wl["user"] == selected_user].iloc[0]
        band = urow["Riesgo"]
        color = data.RISK_COLORS[band]
        timeline = data.user_timeline(scores, features, selected_user, model_key)
        tl = timeline.to_pandas()
        n_user_alerts = int((tl["score"] >= threshold).sum())

        user_meta = (
            features.filter(features["user"] == selected_user)
            .select("role", "department")
            .tail(1)
        )
        role = user_meta["role"][0] if user_meta.height else "—"
        dept = user_meta["department"][0] if user_meta.height else "—"

        # Veredicto
        msg = {
            "Alto": f"Riesgo ALTO — generó {n_user_alerts} día(s) de alerta. Conviene revisarlo.",
            "Medio": "Riesgo MEDIO — comportamiento por encima de lo normal. Vigilar.",
            "Bajo": "Riesgo BAJO — sin desviaciones relevantes.",
        }[band]
        st.markdown(
            f'<div class="verdict" style="background:{color}">'
            f"<b>{selected_user}</b> · {role} · {dept}<br>{msg}</div>",
            unsafe_allow_html=True,
        )
        if show_labels and bool(urow["is_insider_user"]):
            st.warning(
                f"⚠️ **Modo demostración:** este empleado fue una amenaza real "
                f"(escenario {int(urow['scenario'])} del dataset)."
            )

        # Por qué
        st.markdown("#### ¿Por qué es sospechoso?")
        reasons = data.explain_user_day(features, selected_user, urow["peak_day"], top_n=5)
        if reasons:
            st.caption(
                f"Comparado con su propio comportamiento habitual, el "
                f"{urow['peak_day']} hizo:"
            )
            for r in reasons:
                st.markdown(
                    f'<div class="reason"><b>{r["label"]}</b>: {r["value"]:.0f} '
                    f"(su media diaria: {r['avg']:.2f})</div>",
                    unsafe_allow_html=True,
                )
        else:
            st.info("No hay conductas destacadas por encima de su media.")

        # Línea temporal del riesgo
        st.markdown("#### Evolución del riesgo en el tiempo")
        fig = go.Figure()
        fig.add_trace(
            go.Scatter(
                x=tl["day"], y=tl["score"], mode="lines",
                name="Riesgo diario", line=dict(color="#4c6ef5"),
            )
        )
        fig.add_hline(
            y=threshold, line_dash="dash", line_color="#f08c00",
            annotation_text="Umbral de alerta", annotation_position="top left",
        )
        if show_labels:
            mal = tl[tl["label_malicious_day"] == 1]
            if not mal.empty:
                fig.add_trace(
                    go.Scatter(
                        x=mal["day"], y=mal["score"], mode="markers",
                        name="Día de amenaza real",
                        marker=dict(color="#e03131", size=11, symbol="x"),
                    )
                )
        fig.update_layout(
            height=360, margin=dict(t=10, b=10),
            xaxis_title="Fecha", yaxis_title="Nivel de riesgo",
            legend=dict(orientation="h", y=1.12),
        )
        st.plotly_chart(fig, use_container_width=True)

        # Comportamiento del día pico vs su media
        st.markdown("#### Su peor día frente a su rutina normal")
        peak = features.filter(
            (features["user"] == selected_user)
            & (features["day"] == urow["peak_day"])
        ).select(data.SUSPICIOUS_FEATURES)
        if peak.height:
            means = features.filter(features["user"] == selected_user).select(
                [pl.col(f).mean().alias(f) for f in data.SUSPICIOUS_FEATURES]
            )
            labels = [data.FEATURE_LABELS[f] for f in data.SUSPICIOUS_FEATURES]
            peak_vals = [float(peak[f][0]) for f in data.SUSPICIOUS_FEATURES]
            mean_vals = [float(means[f][0]) for f in data.SUSPICIOUS_FEATURES]
            figb = go.Figure()
            figb.add_trace(go.Bar(y=labels, x=mean_vals, name="Su media diaria",
                                  orientation="h", marker_color="#adb5bd"))
            figb.add_trace(go.Bar(y=labels, x=peak_vals, name="Día más anómalo",
                                  orientation="h", marker_color="#e03131"))
            figb.update_layout(
                barmode="group", height=360, margin=dict(t=10, b=10),
                xaxis_title="Nº de veces ese día", legend=dict(orientation="h", y=1.12),
            )
            st.plotly_chart(figb, use_container_width=True)


# ===========================================================================
# PESTAÑA 3 · RENDIMIENTO DEL MÉTODO
# ===========================================================================
with tab_modelo:
    st.markdown("#### ¿Cómo de bueno es cada método?")
    st.caption(
        "Comparativa de los tres métodos a la misma carga de trabajo "
        f"(~{ALERTS_TARGET:.0f} alertas/día). *Aciertos* = % de amenazas reales "
        "detectadas. *Precisión* = de cada 100 alertas, cuántas son reales."
    )

    if show_labels:
        rows = []
        for mk, mname in data.MODELS.items():
            thr = data.threshold_for_alert_rate(scores, mk, ALERTS_TARGET)
            s = data.alerts_at_threshold(scores, mk, thr)
            rows.append(
                {
                    "Método": mname,
                    "Aciertos (recall)": f"{s['recall']:.0%}",
                    "Precisión": f"{s['precision']:.0%}",
                    "Alertas/día": f"{s['alerts_per_day']:.0f}",
                }
            )
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    else:
        st.info("Activa el **modo demostración** para ver los aciertos de cada método.")

    st.markdown("#### Distribución del riesgo en toda la plantilla")
    sp = scores.select(model_key).to_pandas()
    fig_h = go.Figure()
    fig_h.add_trace(go.Histogram(x=sp[model_key], nbinsx=100, marker_color="#4c6ef5"))
    fig_h.add_vline(
        x=threshold, line_dash="dash", line_color="#f08c00",
        annotation_text="Umbral de alerta",
    )
    fig_h.update_layout(
        height=360, margin=dict(t=10, b=10),
        xaxis_title="Nivel de riesgo", yaxis_title="Nº de días (escala log)",
        yaxis_type="log",
    )
    st.plotly_chart(fig_h, use_container_width=True)
    st.caption(
        "Casi todos los días son normales (pico a la izquierda). Solo una "
        "pequeña cola a la derecha es anómala. El umbral decide a partir de "
        "dónde se genera una alerta: muévelo con la *Sensibilidad*."
    )
