# OptiSteel 2.0 — Modelos Estructurales e Hiperestáticos Canónicos H1–H4

## 1. Alcance y Filosofía del Motor de Análisis

OptiSteel 2.0 es un **motor de cálculo analítico cerrado y de alta precisión**, diseñado para proporcionar soluciones exactas, instantáneas y didácticamente transparentes.

> [!IMPORTANT]
> **Delimitación de Alcance:**  
> OptiSteel 2.0 **NO es un software de elementos finitos ni un solver matricial de pórticos espaciales generales**. Su propósito es la resolución rigurosa de vigas continuas y tipologías estructurales canónicas con deducción matemática paso a paso.

---

## 2. Modelos Estáticos Isostáticos

Las vigas isostáticas poseen un grado de indeterminación estática $GIE = 0$. Se resuelven estrictamente mediante las ecuaciones de la estática en el plano ($\sum F_y = 0, \sum M = 0$):

1. **Viga Simplemente Apoyada (Pin-Roller):**
   - Apoyos en extremos o posiciones interiores.
   - Admite cualquier combinación de cargas puntuales, cargas distribuidas (uniformes y trapezoidales) y momentos concentrados.
2. **Viga en Voladizo (Cantilever):**
   - Un único empotramiento rígido (`fixed`) en $x=0$ o $x=L$.
   - Admite cargas arbitrarias en toda la luz libre.
3. **Vigas con Voladizos Extremos (Overhangs):**
   - Dos apoyos interiores con uno o dos tramos en voladizo en los bordes.

---

## 3. Catálogo de Casos Hiperestáticos Soportados (H1–H4)

Cuando la configuración excede los vínculos necesarios para el equilibrio estático ($GIE \ge 1$), OptiSteel activa sus solucionadores analíticos especializados de compatibilidad elástica.

### 3.1. Caso H1 — Viga Empotrada-Apoyada con Carga Puntual
* **Grado de Hiperestatismo:** $GIE = 1$.
* **Configuración de Apoyos:** Un empotramiento (`fixed`) en un extremo y un apoyo simple (`pin` o `roller`) en el otro extremo.
* **Carga Admitida:** Una carga puntual $P$ en cualquier posición $x_P \in (0, L)$ (admite excentricidad arbitraria $a$ desde el empotramiento y $b$ desde el apoyo).
* **Método de Solución:** Compatibilidad de deflexión elástica.
  - Se selecciona la reacción vertical del apoyo simple ($R_B$) como redundante estática.
  - Condición de frontera de compatibilidad:
    $$\Delta_{\text{total}}(x_B) = \Delta_P(x_B) - \Delta_{R_B}(x_B) = 0$$
  - Reacción analítica exacta en el apoyo simple:
    $$R_B = \frac{P \cdot a^2 (3L - a)}{2L^3}$$
  - Momento en el empotramiento:
    $$M_A = -\frac{P \cdot a \cdot b (L + b)}{2L^2}$$
* **Reporte Didáctico:** Desglose del sistema liberado isostático, ecuación de compatibilidad y equilibrio final.

---

### 3.2. Caso H2 — Viga Empotrada-Apoyada con Carga Uniformemente Distribuida
* **Grado de Hiperestatismo:** $GIE = 1$.
* **Configuración de Apoyos:** Empotramiento (`fixed`) en un extremo y apoyo simple (`pin` o `roller`) en el extremo opuesto.
* **Carga Admitida:** Carga uniformemente distribuida $w$ que cubre la totalidad de la luz ($x \in [0, L]$).
* **Método de Solución:** Principio de superposición y compatibilidad elástica.
  - Liberación del apoyo simple $B$ como redundante:
    $$\Delta_w(L) = \frac{w L^4}{8EI}, \qquad \Delta_{R_B}(L) = \frac{R_B L^3}{3EI}$$
  - Condición de apoyo rígido $\Delta(L) = 0$:
    $$R_B = \frac{3}{8} w L$$
  - Reacciones resultantes en el empotramiento $A$:
    $$R_A = \frac{5}{8} w L, \qquad M_A = -\frac{1}{8} w L^2$$
  - Posición de cortante nulo ($V=0$): $x_0 = \frac{5}{8} L$.
  - Momento positivo máximo en vano: $M_{\text{máx}} = +\frac{9}{128} w L^2 \approx 0.0703 w L^2$.

---

### 3.3. Caso H3 — Viga Biempotrada con Carga Uniformemente Distribuida
* **Grado de Hiperestatismo:** $GIE = 2$ (considerando simetría o grado cinemático en flexión).
* **Configuración de Apoyos:** Dos empotramientos rígidos (`fixed`), uno en cada extremo ($x=0$ y $x=L$).
* **Carga Admitida:** Carga uniforme $w$ en toda la luz ($x \in [0, L]$).
* **Método de Solución:** Ecuación diferencial de Euler-Bernoulli con condiciones de doble empotramiento:
  $$v(0) = 0, \quad v'(0) = 0, \quad v(L) = 0, \quad v'(L) = 0$$
* **Reacciones Exactas:**
  $$R_A = R_B = \frac{w L}{2}$$
  $$M_A = M_B = -\frac{w L^2}{12} \quad (\text{Hogante en empotramientos})$$
* **Extremos de Solicitación y Curvatura:**
  - Momento negativo máximo: $M^- = -\frac{w L^2}{12}$ en $x=0$ y $x=L$.
  - Momento positivo máximo: $M^+ = +\frac{w L^2}{24}$ en $x = L/2$.
  - Puntos de inflexión ($M=0$): $x = L \left(\frac{1}{2} \pm \frac{\sqrt{3}}{6}\right) \approx 0.2113 L$ y $0.7887 L$.
  - Flecha máxima al centro:
    $$v_{\text{máx}} = \frac{w L^4}{384 EI}$$

---

### 3.4. Caso H4 — Viga Continua de Dos Vanos con Carga Uniformemente Distribuida
* **Grado de Hiperestatismo:** $GIE = 1$.
* **Configuración de Apoyos:** Tres apoyos simples (un `pin` y dos `roller`), dividiendo la viga en dos vanos contiguos.
* **Carga Admitida:** Carga distribuida uniforme $w$ continua en ambos vanos.
* **Método de Solución:** Ecuación de los Tres Momentos de Clapeyron o compatibilidad de giros relativos sobre el apoyo intermedio $B$:
  $$\theta_{BA} = \theta_{BC}$$
* **Para dos vanos simétricos de longitud $L_v = L/2$:**
  - Reacción en apoyos extremos: $R_1 = R_3 = \frac{3}{16} w L = \frac{3}{8} w L_v$.
  - Reacción en apoyo central: $R_2 = \frac{10}{16} w L = \frac{5}{4} w L_v$.
  - Momento sobre el apoyo central: $M_B = -\frac{w L_v^2}{8} = -\frac{w L^2}{32}$.
  - Momento positivo máximo en vanos: $M_{\text{máx}} = +\frac{9}{128} w L_v^2$ a $x = \frac{3}{8} L_v$ y $x = L - \frac{3}{8} L_v$.
  - Flecha máxima simétrica en ambos vanos: $x \approx 0.4215 L_v$ con $v_{\text{máx}} \approx 0.0054 \frac{w L_v^4}{EI}$.

---

## 4. Configuraciones Expresamente Rechazadas

El validador de OptiSteel (`validator.ts`) protege la integridad de los cálculos detectando y rechazando explícitamente configuraciones que caen fuera de los modelos implementados:

1. **Mecanismos e Inestabilidad Estática:**
   - Vigas con menos de 2 reacciones verticales restrictivas (ej. viga libre o con un solo rodillo).
   - Apoyos redundantes puramente cinemáticos con grados de libertad no restringidos.
2. **Hiperestatismo no Soportado:**
   - Vigas continuas con 4 o más apoyos (3 o más vanos).
   - Vigas con combinaciones de 3 o más empotramientos rígidos.
   - Vigas biempotradas con cargas triangulares o cargas puntuales múltiples asimétricas no codificadas.
   - En estos casos, la aplicación emite un mensaje claro indicando que la tipología excede el alcance del motor analítico cerrado de OptiSteel 2.0.

