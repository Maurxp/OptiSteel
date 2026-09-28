import csv
import os
import re
import pandas as pd
import streamlit as st

# Módulo de elasticidad del acero estructural (200 GPa = 200,000 MPa)
E_ACERO = 200_000.0

st.set_page_config(
    page_title="OptiSteel Pro — Selector de Vigas",
    page_icon="🏗️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Estilo visual moderno para métricas y tarjetas
st.markdown(
    """
    <style>
        .block-container { padding-top: 1.5rem; padding-bottom: 2rem; }
        div[data-testid="stMetricValue"] { font-size: 1.6rem; color: #38bdf8; }
        .success-box {
            background-color: #0f291e;
            border-left: 5px solid #10b981;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
        }
    </style>
""",
    unsafe_allow_html=True,
)


@st.cache_data
def cargar_catalogo(ruta="perfiles_estructurales.csv"):
    if not os.path.exists(ruta):
        return []
    perfiles = []
    with open(ruta, mode="r", encoding="utf-8") as f:
        lector = csv.DictReader(f)
        for r in lector:
            perfiles.append(
                {
                    "tipo": r["tipo"].strip().upper(),
                    "designacion": r["designacion"].strip(),
                    "masa": float(r["masa_kg_m"]),
                    "d": float(r["d_mm"]),
                    "tw": float(r["tw_mm"]),
                    "Ix": float(r["Ix_10e6_mm4"]),
                    "Sx": float(r["Sx_10e3_mm3"]),
                }
            )
    return perfiles


catalogo = cargar_catalogo()

# ---------------- BARRA LATERAL (ENTRADAS) ----------------
with st.sidebar:
    st.title("⚙️ Parámetros de Diseño")
    st.caption("Pytel-Singer Structural Engine (Normas NSR-10 / AISC / IBC)")

    tipo_sel = st.selectbox(
        "Tipo de Perfil",
        ["W (Ala Ancha)", "S (Vigas I)", "C (Canales)", "TODOS"],
        index=0,
    )

    col_in1, col_in2 = st.columns(2)
    with col_in1:
        M_ext = st.number_input(
            "Momento M (kN·m)", min_value=0.1, value=150.0, step=5.0
        )
        L = st.number_input(
            "Longitud L (m)", min_value=0.5, value=6.0, step=0.5
        )
    with col_in2:
        V_ext = st.number_input(
            "Cortante V (kN)", min_value=0.1, value=75.0, step=5.0
        )
        sigma_adm = st.number_input(
            "Esfuerzo σ adm (MPa)", min_value=10.0, value=140.0, step=5.0
        )

    opciones_flecha = [
        "360 | L/360: NSR-10 C.9.5(b) & IBC Tab. 1604.3 (Pisos L)",
        "240 | L/240: NSR-10 C.9.5(b) & AISC DG-3 (Pisos D+L)",
        "180 | L/180: IBC Tab. 1604.3 & NSR-10 (Cubiertas)",
        "480 | L/480: NSR-10 C.9.5(b) & ACI 318 (Acabados frágiles)",
        "600 | L/600: AISC Design Guide 3 (Fachadas mampostería)",
    ]
    flecha_sel = st.selectbox(
        "Límite de flecha admisible", opciones_flecha, index=0
    )

    # Subir CSV personalizado opcional
    uploaded_file = st.file_uploader(
        "¿Usar otro catálogo CSV?", type=["csv"], help="Opcional"
    )
    if uploaded_file is not None:
        try:
            df_custom = pd.read_csv(uploaded_file)
            catalogo = [
                {
                    "tipo": str(r["tipo"]).strip().upper(),
                    "designacion": str(r["designacion"]).strip(),
                    "masa": float(r["masa_kg_m"]),
                    "d": float(r["d_mm"]),
                    "tw": float(r["tw_mm"]),
                    "Ix": float(r["Ix_10e6_mm4"]),
                    "Sx": float(r["Sx_10e3_mm3"]),
                }
                for _, r in df_custom.iterrows()
            ]
            st.success(f"{len(catalogo)} perfiles cargados desde archivo.")
        except Exception as e:
            st.error(f"Error en formato CSV: {e}")

# ---------------- MOTOR DE CÁLCULO ----------------
match_num = re.search(r"(\d+)", flecha_sel)
limite_flecha = float(match_num.group(1)) if match_num else 360.0

tipo_filtro = tipo_sel.split()[0] if " " in tipo_sel else tipo_sel
pool = (
    [p for p in catalogo if p["tipo"] == tipo_filtro]
    if tipo_filtro in ["W", "S", "C"]
    else catalogo
)

tau_adm = 0.60 * sigma_adm
flecha_adm = (L * 1000.0) / limite_flecha
g = 9.81
S_req_ext = (M_ext * 1e6) / (sigma_adm * 1000.0)

candidatos = []
for p in pool:
    w_pp = (p["masa"] * g) / 1000.0
    M_pp = (w_pp * (L**2)) / 8.0
    V_pp = (w_pp * L) / 2.0

    M_total = M_ext + M_pp
    V_total = V_ext + V_pp

    S_pp = (M_pp * 1e6) / (sigma_adm * 1000.0)
    sigma_real = (M_total * 1e6) / (p["Sx"] * 1000.0)

    area_alma = p["d"] * p["tw"]
    tau_real = (V_total * 1000.0) / area_alma if area_alma > 0 else 999.0

    I_mm4 = p["Ix"] * 1e6
    delta_pp = (5.0 * w_pp * ((L * 1000.0) ** 4)) / (384.0 * E_ACERO * I_mm4)
    delta_ext = (M_ext * 1e6 * ((L * 1000.0) ** 2)) / (10.0 * E_ACERO * I_mm4)
    delta_total = delta_pp + delta_ext

    if (
        sigma_real <= sigma_adm
        and tau_real <= tau_adm
        and delta_total <= flecha_adm
    ):
        candidatos.append(
            {
                "Perfil": p["designacion"],
                "Tipo": p["tipo"],
                "Masa (kg/m)": round(p["masa"], 1),
                "Sx (10³ mm³)": round(p["Sx"], 0),
                "S_pp req": round(S_pp, 2),
                "σ real (MPa)": round(sigma_real, 1),
                "τ real (MPa)": round(tau_real, 1),
                "Flecha (mm)": round(delta_total, 2),
                "Uso σ (%)": round((sigma_real / sigma_adm) * 100.0, 1),
            }
        )

# ---------------- VISTA PRINCIPAL (DASHBOARD) ----------------
st.title("OptiSteel Pro")
st.caption("Selector y Optimizador Automatizado de Perfiles Estructurales de Acero")

if not catalogo:
    st.error(
        "No se encontró el archivo `perfiles_estructurales.csv`. Súbelo en el panel lateral."
    )
elif not candidatos:
    st.warning(
        "⚠️ Ningún perfil del catálogo seleccionado satisfizo los esfuerzos y la flecha admisible."
    )
else:
    candidatos.sort(key=lambda x: x["Masa (kg/m)"])
    optimo = candidatos[0]

    # Tarjeta de perfil ganador
    st.markdown(
        f"""
        <div class="success-box">
            <h4 style="margin:0; color:#10b981;">PERFIL ÓPTIMO SELECCIONADO</h4>
            <h1 style="margin:0; font-size:2.4rem; color:#ffffff;">{optimo['Perfil']}</h1>
        </div>
    """,
        unsafe_allow_html=True,
    )

    # Cuadrícula de Métricas
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Masa lineal", f"{optimo['Masa (kg/m)']} kg/m")
    m2.metric(
        "Esfuerzo real", f"{optimo['σ real (MPa)']} MPa", f"Adm: {sigma_adm} MPa"
    )
    m3.metric("Capacidad Usada", f"{optimo['Uso σ (%)']}%")
    m4.metric(
        "Deflexión máx",
        f"{optimo['Flecha (mm)']} mm",
        f"Límite: {flecha_adm:.2f} mm",
    )

    st.divider()

    # Tabla interactiva
    st.subheader(
        f"📋 Perfiles que cumplen ({len(candidatos)} candidatos viables)"
    )
    df_resultado = pd.DataFrame(candidatos)

    st.dataframe(
        df_resultado,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Uso σ (%)": st.column_config.ProgressColumn(
                "Uso σ (%)", min_value=0, max_value=100, format="%.1f%%"
            ),
        },
    )
