# OptiSteel 2.0 — Convenciones, Unidades y Formulación Estática

## 1. Sistema Canónico de Unidades

OptiSteel 2.0 emplea de manera estricta y consistente las unidades del **Sistema Internacional (SI)** adaptadas a la práctica profesional de la ingeniería estructural:

| Parámetro Físico | Símbolo | Unidad de Entrada / Cálculo | Unidad de Despliegue en UI | Factor de Conversión Interno |
| :--- | :--- | :--- | :--- | :--- |
| **Longitud y cotas** | $L, x$ | Metros ($\text{m}$) | Metros ($\text{m}$) | $1\text{ m} = 1000\text{ mm}$ |
| **Cargas puntuales** | $P$ | Kilonewtons ($\text{kN}$) | Kilonewtons ($\text{kN}$) | $1\text{ kN} = 10^3\text{ N}$ |
| **Cargas distribuidas** | $w$ | Kilonewtons/metro ($\text{kN/m}$) | Kilonewtons/metro ($\text{kN/m}$) | $1\text{ kN/m} = 1\text{ N/mm}$ |
| **Momentos concentrados** | $M_0$ | Kilonewton-metro ($\text{kN}\cdot\text{m}$) | Kilonewton-metro ($\text{kN}\cdot\text{m}$) | $1\text{ kN}\cdot\text{m} = 10^6\text{ N}\cdot\text{mm}$ |
| **Reacciones verticales** | $R_y$ | Kilonewtons ($\text{kN}$) | Kilonewtons ($\text{kN}$) | $1\text{ kN} = 10^3\text{ N}$ |
| **Momentos de reacción** | $M_r$ | Kilonewton-metro ($\text{kN}\cdot\text{m}$) | Kilonewton-metro ($\text{kN}\cdot\text{m}$) | $1\text{ kN}\cdot\text{m} = 10^6\text{ N}\cdot\text{mm}$ |
| **Módulo de elasticidad** | $E$ | Gigapascales ($\text{GPa}$) | Gigapascales ($\text{GPa}$) | $1\text{ GPa} = 10^3\text{ MPa} = 10^3\text{ N/mm}^2$ |
| **Momento de inercia** | $I_z$ | $\text{cm}^4$ | $\text{cm}^4$ | $1\text{ cm}^4 = 10^4\text{ mm}^4 = 10^{-8}\text{ m}^4$ |
| **Rigidez flexionante** | $EI$ | $\text{kN}\cdot\text{m}^2$ | $\text{kN}\cdot\text{m}^2$ | $EI [\text{kN}\cdot\text{m}^2] = E [\text{GPa}] \times I_z [\text{cm}^4] \times 10^{-2}$ |
| **Módulo de sección** | $W_z, S$ | $\text{cm}^3$ | $\text{cm}^3$ | $1\text{ cm}^3 = 10^3\text{ mm}^3$ |
| **Esfuerzos normales** | $\sigma$ | Megapascales ($\text{MPa}$) | Megapascales ($\text{MPa}$) | $1\text{ MPa} = 1\text{ N/mm}^2 = 10^3\text{ kN/m}^2$ |
| **Esfuerzos cortantes** | $\tau$ | Megapascales ($\text{MPa}$) | Megapascales ($\text{MPa}$) | $1\text{ MPa} = 1\text{ N/mm}^2$ |
| **Deflexión (flecha)** | $v, \delta$ | Metros ($\text{m}$) | Milímetros ($\text{mm}$) | $1\text{ m} = 1000\text{ mm}$ |
| **Giro / Pendiente** | $\theta$ | Radianes ($\text{rad}$) | Radianes / Grados ($^\circ$) | $1\text{ rad} = \frac{180}{\pi}^\circ \approx 57.2958^\circ$ |

---

## 2. Convención de Signos Estructural

OptiSteel 2.0 adopta una convención física unificada, alineada con la formulación estándar de Resistencia de Materiales y la estática de vigas:

### 2.1. Cargas Externas
* **Fuerzas Puntuales ($P$):** Se definen positivas hacia abajo ($\downarrow$). Una fuerza hacia arriba se ingresa con signo negativo.
* **Cargas Distribuidas ($w$):** Se definen positivas actuando verticalmente hacia abajo ($\downarrow$).
* **Momentos Concentrados ($M_0$):** Se definen positivos en sentido **antihorario** ($\circlearrowleft$).

### 2.2. Reacciones en Apoyos
* **Fuerza Vertical ($R_y$):** Positiva hacia arriba ($\uparrow$).
* **Momento de Reacción en Empotramiento ($M_r$):** Positivo en sentido **antihorario** ($\circlearrowleft$).
* **Equilibrio Global:**
  $$\sum F_y = \sum R_y - \sum P_i - \int w(x) \, dx = 0$$
  $$\sum M_{@(x=0)} = \sum M_r + \sum (R_{y, i} \cdot x_i) - \sum (P_j \cdot x_j) - \int w(x) \cdot x \, dx + \sum M_{0, k} = 0$$

### 2.3. Esfuerzo Cortante Interno $V(x)$
* En una sección transversal con normal saliente hacia la derecha ($+x$):
  - Cortante positivo $V > 0$ actúa verticalmente hacia abajo en la cara derecha (y hacia arriba en la cara izquierda), tendiendo a rotar el elemento en sentido horario.
* Relación diferencial con la carga:
  $$\frac{dV(x)}{dx} = -w(x)$$

### 2.4. Momento Flector Interno $M(x)$
* **Momento Positivo ($M > 0$, Sagante / Flexión Positiva):**
  - Tracción en las fibras inferiores (+).
  - Compresión en las fibras superiores (-).
  - Curvatura cóncava hacia arriba ($\cup$).
* **Momento Negativo ($M < 0$, Hogante / Flexión Negativa):**
  - Tracción en las fibras superiores (+).
  - Compresión en las fibras inferiores (-).
  - Curvatura convexa hacia arriba ($\cap$).
* Relación diferencial con el cortante:
  $$\frac{dM(x)}{dx} = V(x)$$

### 2.5. Ecuación de la Elástica y Deflexión $v(x)$
* En el sistema de coordenadas de OptiSteel, $y$ es positivo hacia arriba:
  $$EI \frac{d^2 v(x)}{dx^2} = -M(x)$$
  $$\theta(x) = \frac{dv(x)}{dx}$$
* **Flecha descendente:** $v(x) < 0$. En los paneles de resultados de usuario, la flecha hacia abajo se reporta con su magnitud absoluta $|v|$ rotulada como `↓ Descenso`.
* **Levantamiento:** $v(x) > 0$. Se reporta como `↑ Levantamiento`.

