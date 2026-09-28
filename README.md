# OptiSteel Pro 🏗️

> **Selector y Optimizador Automatizado de Vigas de Acero Estructural**  
> Basado en la formulación de Resistencia de Materiales (*Pytel & Singer*) y normativas de diseño sismorresistente y servicio (**NSR-10**, **AISC 360 / DG-3**, **IBC 2024**, **ACI 318**).

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Framework](https://img.shields.io/badge/GUI-Tkinter%20%7C%20Streamlit-emerald.svg)](https://streamlit.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Standard](https://img.shields.io/badge/Normativa-NSR--10%20%7C%20AISC%20%7C%20IBC-red.svg)](#normativas-y-criterios-de-servicio)

---

## 📌 Descripción

**OptiSteel Pro** es una herramienta de ingeniería computacional diseñada para resolver de manera óptima el dimensionamiento elástico de vigas simplemente apoyadas sometidas a flexión pura, cortante y restricciones normativas de flecha (deflexión).

El sistema desacopla el catálogo de perfiles mediante un archivo externo `.csv` y analiza iterativamente perfiles comerciales tipo **W (Ala Ancha)**, **S (Vigas I estándar)** y **C (Canales)**, determinando la solución más económica (menor masa por metro lineal) considerando de forma automática el incremento de solicitaciones provocado por el **peso propio** del miembro estructural.

---

## ⚙️ Características Técnicas

* **Filtrado Multi-Perfil:** Evalúa familias individuales (`W`, `S`, `C`) o ejecuta un barrido simultáneo (`TODOS`) para encontrar la sección transversal más eficiente del mercado.
* **Cálculo Riguroso de Peso Propio:** Integra el peso propio ($w_{pp}$) al momento central ($M_{pp} = \frac{w_{pp}L^2}{8}$) y al cortante de apoyo ($V_{pp} = \frac{w_{pp}L}{2}$), recalculando el módulo demandado ($S_{pp}$).
* **Triple Verificación Simultánea:**
  * **Resistencia a Flexión:** $\sigma_{\text{real}} \le \sigma_{\text{adm}}$ (Fórmula de Navier-Bernoulli).
  * **Resistencia a Cortante en Alma:** $\tau_{\text{real}} = \frac{V_{\text{total}}}{d \cdot t_w} \le \tau_{\text{adm}}$ (AISC ASD / NSR-10 Título F).
  * **Rigidez y Flecha Elástica:** $\Delta_{\text{total}} \le \Delta_{\text{adm}} = \frac{L}{X}$.
* **Arquitectura Dual:**
  * Versión Escritorio con GUI nativa moderna en **Tkinter** empaquetable a ejecutable `.exe` con `PyInstaller`.
  * Versión Web interactiva y responsiva con **Streamlit** (compatible con navegadores móviles, escritorio y PWA en iOS/Android).
* **Catálogo Abierto (CSV-Driven):** Carga dinámica de secciones estructurales basada en el Apéndice B (Tabla B-2) del texto guía *Resistencia de Materiales* de Andrew Pytel y Ferdinand L. Singer.

---

## 📐 Fundamento Teórico y Formulación Matemática

El motor de cálculo ejecuta las siguientes etapas para cada perfil viable:

1. **Carga gravitacional por peso propio:**
   $$w_{pp} = \frac{m \cdot g}{1000} \quad [\text{kN/m}]$$
   con $g = 9.81\text{ m/s}^2$ y masa lineal $m$ en $\text{kg/m}$

2. **Solicitaciones acumuladas críticas:**
   $$M_{\text{total}} = M_{\text{ext}} + \frac{w_{pp} \cdot L^2}{8} \quad [\text{kN}\cdot\text{m}]$$
   $$V_{\text{total}} = V_{\text{ext}} + \frac{w_{pp} \cdot L}{2} \quad [\text{kN}]$$

3. **Módulo elástico demandado por peso propio:**
   $$S_{pp} = \frac{M_{pp}}{\sigma_{\text{adm}}} = \frac{M_{pp} \times 10^6}{\sigma_{\text{adm}} \times 1000} \quad [10^3\text{ mm}^3]$$

4. **Esfuerzo real a flexión:**
   $$\sigma_{\text{real}} = \frac{M_{\text{total}} \times 10^6}{S_x \times 1000} \quad [\text{MPa}]$$

5. **Esfuerzo cortante medio en el alma:**
   $$\tau_{\text{real}} = \frac{V_{\text{total}} \times 1000}{d \cdot t_w} \quad [\text{MPa}] \quad \le \quad \tau_{\text{adm}} = 0.60 \cdot \sigma_{\text{adm}}$$

6. **Deflexión total acumulada ($E = 200\,000\text{ MPa}$):**
   $$\Delta_{\text{total}} = \Delta_{pp} + \Delta_{\text{ext}} = \frac{5 \cdot w_{pp} \cdot (L \times 1000)^4}{384 \cdot E \cdot (I_x \times 10^6)} + \frac{M_{\text{ext}} \times 10^6 \cdot (L \times 1000)^2}{10 \cdot E \cdot (I_x \times 10^6)} \quad [\text{mm}]$$

---

## 🏛️ Normativas y Criterios de Servicio

| Límite | Origen Normativo | Campo de Aplicación Estructural |
| :--- | :--- | :--- |
| **$L/180$** | **IBC** Tabla 1604.3 / **NSR-10** Tabla C.9.5(b) | Cubiertas industriales ligeras con teja metálica sin cielo raso. |
| **$L/240$** | **IBC** Tabla 1604.3 / **AISC** Design Guide 3 | Pisos bajo carga total ($D + L$) o cubiertas con acabados no frágiles. |
| **$L/360$** | **IBC** Tabla 1604.3 / **NSR-10** Tabla C.9.5(b) | Entrepisos residenciales/comerciales bajo carga viva con cielo raso de yeso. |
| **$L/480$** | **ACI 318** Tabla 24.2.2 / **NSR-10** Tabla C.9.5(b) | Entrepisos que soportan muros divisorios o acabados susceptibles a fisuración. |
| **$L/600$** | **AISC** Design Guide 3 (Sección 4.2) | Vigas perimetrales que cargan muros de mampostería o fachadas vidriadas. |

---

## 📂 Estructura del Repositorio

```text
OptiSteel-web/
├── app.py                         # Aplicación Web (Streamlit)
├── app_desktop.py                 # Aplicación de Escritorio con GUI (Tkinter)
├── perfiles_estructurales.csv     # Base de datos de perfiles (Pytel-Singer Tabla B-2)
├── requirements.txt               # Dependencias de Python
├── icono.ico                      # Icono de aplicación para Windows (.exe)
├── icono.png                      # Icono en alta resolución para Web / Tkinter
├── LICENSE                        # Licencia MIT
└── README.md                      # Documentación del proyecto
