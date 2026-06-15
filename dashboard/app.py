"""Dashboard SIEM/UEBA — detección de insider threats (CERT r4.2).

Ejecutar con: streamlit run dashboard/app.py (desde la raíz del proyecto).
"""
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from dashboard import data

st.set_page_config(page_title="SIEM · Insider Threat UEBA", layout="wide")

st.title("SIEM · Insider Threat UEBA")
st.caption(
    "Mini-SIEM sobre el dataset CERT r4.2: detección de anomalías de "
    "comportamiento de usuario (UEBA) con modelos de baseline, "
    "Isolation Forest y Autoencoder."
)


# ---------------------------------------------------------------------------
# Carga cacheada de datos
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
# Sidebar: selección de modelo, umbral y modo demo
# ---------------------------------------------------------------------------
st.sidebar.header("Configuración")

model_key = st.sidebar.selectbox(
    "Modelo de scoring",
    options=list(data.MODELS.keys()),
    format_func=lambda k: data.MODELS[k],
)

score_min = float(scores[model_key].min())
score_max = float(scores[model_key].max())
default_threshold = data.threshold_for_alert_rate(scores, model_key, alerts_per_day=10.0)
# El slider necesita que min < max y que el valor por defecto esté dentro del rango.
default_threshold = min(max(default_threshold, score_min), score_max)

threshold = st.sidebar.slider(
    "Umbral de alerta (score)",
    min_value=score_min,
    max_value=score_max,
    value=default_threshold,
    help="Por encima de este score, un usuario-día se considera una alerta.",
)

show_labels = st.sidebar.checkbox("Mostrar etiquetas reales (demo)", value=True)
st.sidebar.caption(
    "En un SIEM real no se conocen las etiquetas de insider/escenario. "
    "Aquí se usan únicamente para validar el rendimiento de los modelos."
)


# ---------------------------------------------------------------------------
# Fila de métricas
# ---------------------------------------------------------------------------
alert_stats = data.alerts_at_threshold(scores, model_key, threshold)
watchlist = data.user_watchlist(scores, model_key, top_n=50)

if show_labels:
    cols = st.columns(5)
else:
    cols = st.columns(3)

cols[0].metric("Alertas totales", f"{alert_stats['n_alerts']:,}")
cols[1].metric("Alertas / día", f"{alert_stats['alerts_per_day']:.2f}")
if show_labels:
    cols[2].metric("Recall", f"{alert_stats['recall']:.1%}")
    cols[3].metric("Precisión", f"{alert_stats['precision']:.1%}")
    cols[4].metric("Usuarios en watchlist", f"{watchlist.height}")
else:
    cols[2].metric("Usuarios en watchlist", f"{watchlist.height}")


# ---------------------------------------------------------------------------
# Pestañas principales
# ---------------------------------------------------------------------------
tab_watchlist, tab_drilldown, tab_global = st.tabs(
    ["Watchlist", "Drill-down por usuario", "Vista global"]
)


# --- Pestaña 1: Watchlist ---------------------------------------------------
with tab_watchlist:
    st.subheader("Watchlist: top usuarios por riesgo")
    st.caption(
        f"Top {watchlist.height} usuarios ordenados por su score máximo "
        f"({data.MODELS[model_key]})."
    )

    watchlist_pd = watchlist.to_pandas()

    if show_labels:
        st.dataframe(
            watchlist_pd.style.apply(
                lambda row: [
                    "background-color: #5c1a1a" if row["is_insider_user"] else ""
                ]
                * len(row),
                axis=1,
            ),
            use_container_width=True,
        )
    else:
        # Sin etiquetas, ocultamos las columnas de ground truth.
        st.dataframe(
            watchlist_pd.drop(columns=["is_insider_user", "scenario"]),
            use_container_width=True,
        )

    st.markdown("**Top 20 usuarios por score máximo**")
    top20 = watchlist_pd.head(20).sort_values("max_score")
    if show_labels:
        top20["Tipo"] = top20["is_insider_user"].map(
            {True: "Insider conocido", False: "Usuario normal"}
        )
        fig_bar = px.bar(
            top20,
            x="max_score",
            y="user",
            color="Tipo",
            orientation="h",
            color_discrete_map={
                "Insider conocido": "#d62728",
                "Usuario normal": "#1f77b4",
            },
            labels={"max_score": "Score máximo", "user": "Usuario"},
        )
    else:
        fig_bar = px.bar(
            top20,
            x="max_score",
            y="user",
            orientation="h",
            labels={"max_score": "Score máximo", "user": "Usuario"},
        )
    fig_bar.update_layout(height=600)
    st.plotly_chart(fig_bar, use_container_width=True)


# --- Pestaña 2: Drill-down por usuario --------------------------------------
with tab_drilldown:
    st.subheader("Análisis detallado de un usuario")

    watchlist_users = watchlist["user"].to_list()
    selected_user = st.selectbox(
        "Usuario", options=watchlist_users, index=0 if watchlist_users else None
    )

    if selected_user:
        timeline = data.user_timeline(scores, features, selected_user, model_key)

        # Metadatos de rol/departamento del usuario (más recientes disponibles).
        user_meta = (
            features.filter(features["user"] == selected_user)
            .select("role", "department")
            .tail(1)
        )

        col_info1, col_info2, col_info3 = st.columns(3)
        if user_meta.height > 0:
            col_info1.metric("Rol", user_meta["role"][0])
            col_info2.metric("Departamento", user_meta["department"][0])
        if show_labels:
            row = watchlist.filter(watchlist["user"] == selected_user)
            if row.height > 0:
                is_insider = row["is_insider_user"][0]
                scenario = row["scenario"][0]
                if is_insider:
                    col_info3.metric("Insider conocido", f"Sí (escenario {scenario})")
                else:
                    col_info3.metric("Insider conocido", "No")

        # Gráfico de línea temporal del score
        timeline_pd = timeline.to_pandas()
        fig_score = go.Figure()
        fig_score.add_trace(
            go.Scatter(
                x=timeline_pd["day"],
                y=timeline_pd["score"],
                mode="lines",
                name=data.MODELS[model_key],
                line=dict(color="#1f77b4"),
            )
        )
        fig_score.add_hline(
            y=threshold,
            line_dash="dash",
            line_color="orange",
            annotation_text="Umbral de alerta",
        )
        if show_labels:
            malicious = timeline_pd[timeline_pd["label_malicious_day"] == 1]
            if not malicious.empty:
                fig_score.add_trace(
                    go.Scatter(
                        x=malicious["day"],
                        y=malicious["score"],
                        mode="markers",
                        name="Día malicioso (real)",
                        marker=dict(color="red", size=10, symbol="x"),
                    )
                )
        fig_score.update_layout(
            title=f"Evolución del score diario — {selected_user}",
            xaxis_title="Día",
            yaxis_title="Score de anomalía",
            height=400,
        )
        st.plotly_chart(fig_score, use_container_width=True)

        # Gráfico de features sospechosas a lo largo del tiempo
        fig_features = go.Figure()
        for feat in data.SUSPICIOUS_FEATURES:
            fig_features.add_trace(
                go.Scatter(
                    x=timeline_pd["day"],
                    y=timeline_pd[feat],
                    mode="lines",
                    stackgroup="features",
                    name=feat,
                )
            )
        fig_features.update_layout(
            title="Features sospechosas crudas a lo largo del tiempo",
            xaxis_title="Día",
            yaxis_title="Conteo",
            height=400,
        )
        st.plotly_chart(fig_features, use_container_width=True)

        # Tabla con los días de mayor score
        st.markdown("**Días con mayor score**")
        top_days = timeline.sort("score", descending=True).head(10)
        st.dataframe(top_days.to_pandas(), use_container_width=True)


# --- Pestaña 3: Vista global -------------------------------------------------
with tab_global:
    st.subheader("Distribución global de scores")

    scores_pd = scores.select(model_key).to_pandas()
    fig_hist = px.histogram(
        scores_pd,
        x=model_key,
        nbins=100,
        labels={model_key: f"Score ({data.MODELS[model_key]})"},
        log_y=True,
    )
    fig_hist.add_vline(
        x=threshold,
        line_dash="dash",
        line_color="orange",
        annotation_text="Umbral de alerta",
    )
    fig_hist.update_layout(
        title="Distribución de scores (todos los usuario-día)",
        yaxis_title="Frecuencia (escala log)",
        height=450,
    )
    st.plotly_chart(fig_hist, use_container_width=True)

    st.markdown(
        """
        **El trade-off del umbral**

        La gran mayoría de los usuario-día tienen scores muy bajos
        (comportamiento normal); solo una pequeña cola corresponde a
        actividad anómala. Mover el umbral hacia la izquierda genera
        más alertas: aumenta el *recall* (se detectan más días
        maliciosos) pero baja la *precisión* (más falsos positivos por
        cada detección real), saturando al analista del SOC. Moverlo
        hacia la derecha reduce el volumen de alertas y mejora la
        precisión, pero arriesga dejar pasar incidentes reales (menor
        recall). La métrica operativa **alertas/día** ayuda a fijar un
        umbral que el equipo pueda investigar de forma sostenible.
        """
    )
