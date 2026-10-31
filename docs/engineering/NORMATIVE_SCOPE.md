# OptiSteel 2.0 — Alcance Normativo y Matriz Comparativa

## 1. Declaración de Alcance y Advertencia Profesional

> [!CAUTION]
> **DESCARGO DE RESPONSABILIDAD PROFESIONAL:**  
> OptiSteel 2.0 es un software de modelado elástico, investigación y prediseño académico de elementos estructurales. Sus algoritmos implementan comprobaciones preliminares basadas en principios fundamentales de Resistencia de Materiales y fórmulas canónicas de diseño.  
> **OptiSteel 2.0 NO reemplaza el juicio ingenieril, la memoria de cálculo estructural certificada ni la responsabilidad profesional exigida por las leyes de ejercicio de la ingeniería civil.**

---

## 2. Matriz Exhaustiva de Alcance Normativo

A continuación se desglosa el estado real de implementación frente a las normas estructurales de referencia más utilizadas (**AISC 360-16 / 360-22**, **NSR-10 Título F**, **IBC 2021 / 2024**, **Eurocódigo 3 EN 1993-1-1**):

| Aspecto Estructural | Implementado en OptiSteel 2.0 | No Implementado / Fuera de Alcance | Observaciones y Referencia Técnica |
| :--- | :---: | :---: | :--- |
| **Flexión Elástica en Régimen Lineal** | **SÍ** | — | Cálculo exacto de esfuerzos normales $\sigma = M / W_z$ en secciones simétricas. |
| **Extremos Duales de Momento ($M^+, M^-$)** | **SÍ** | — | Identificación independiente de momentos positivos y negativos con sus respectivas fibras de tracción y compresión. |
| **Cortante Medio en Alma ($V / (d \cdot t_w)$)** | **SÍ** | — | Conforme a la hipótesis tradicional de diseño elástico ASD de AISC 360 y NSR-10 Capítulo F.2. |
| **Cortante Elástico Máximo (Jourawski)** | **SÍ** | — | Formulación elástica exacta $\tau = VQ / (I \cdot t_w)$ en el eje neutro para perfiles I/W con dimensiones completas. |
| **Incorporación Iterativa de Peso Propio** | **SÍ** | — | Recálculo automático de la carga muerta distribuida $w_{pp} = m \cdot g$ sobre solicitaciones y deflexión en cada candidato. |
| **Deflexión Elástica Continua** | **SÍ** | — | Solución analítica exacta de la curva elástica $v(x)$ y pendientes $\theta(x)$ mediante Euler-Bernoulli. |
| **Verificación ELS por Vanos y Voladizos** | **SÍ** | — | Descomposición por tramos ($L_{\text{span}}/n$) y criterio de voladizo simétrico equivalente ($2a/n$). Denominador $n$ configurable. |
| **Pandeo Lateral-Torsional (PLT)** | **NO** | **X** | **Fuera de alcance:** Se asume soporte lateral continuo del ala en compresión ($L_b \le L_p$). No se calculan longitudes no arriostradas $L_b$, momentos elásticos de pandeo $M_{cr}$ ni factores de modificación por gradiente de momento $C_b$. |
| **Pandeo Local de Alas y Alma (Esbeltez)** | **NO** | **X** | **Fuera de alcance:** No se clasifican secciones en compactas, no compactas o esbeltas según las relaciones ancho-espesor $\lambda = b/t$ de la Tabla B4.1b de AISC 360 o NSR-10 F.2. |
| **Diseño por Factores de Carga y Resistencia (LRFD)** | **NO** | **X** | **Fuera de alcance:** El selector evalúa tensiones admisibles en servicio (enfoque ASD preliminar). No aplica factores de reducción de resistencia $\phi$ ($\phi_b = 0.90, \phi_v = 0.90$). |
| **Combinaciones de Carga Facturadas** | **NO** | **X** | **Fuera de alcance:** No genera combinaciones automáticas de carga última ($1.4D$, $1.2D + 1.6L + 0.5S$, combinaciones de sismo o viento). El usuario ingresa cargas de servicio totales directamente. |
| **Interacción Biaxial y Torsión** | **NO** | **X** | **Fuera de alcance:** Se analiza exclusivamente flexión uniaxial alrededor del eje principal fuerte ($z-z$). No se evalúa flexión esviada ni alabeo torsional ($C_w$). |
| **Diseño de Conexiones y Placas de Asiento** | **NO** | **X** | **Fuera de alcance:** El software modela vínculos ideales (pin, roller, fixed). No dimensiona soldaduras, pernos ni rigidizadores de alma por concentración de esfuerzos concentrados (aplastamiento, pandeo del alma). |

---

## 3. Criterios de Deformabilidad de Servicio (Límites $L/n$)

OptiSteel 2.0 admite los límites elásticos estándar recomendados por los códigos de construcción:

| Relación | Origen Normativo Principal | Campo de Aplicación Estructural Recomendado |
| :---: | :--- | :--- |
| **$L/180$** | **IBC** Tabla 1604.3 / **NSR-10** Tabla C.9.5(b) | Cubiertas industriales ligeras con lámina metálica sin cielo raso susceptible a fisurarse. |
| **$L/240$** | **AISC** Design Guide 3 / **IBC** Tabla 1604.3 | Entrepisos bajo carga total ($D + L$) o cubiertas con cielorrasos flexibles no frágiles. |
| **$L/360$** | **AISC 360** Comentario L / **NSR-10** Tabla C.9.5(b) | Entrepisos residenciales y comerciales bajo carga viva ($L$) con acabados o cielos de yeso estándar. *(Valor predeterminado en OptiSteel)*. |
| **$L/480$** | **ACI 318** Tabla 24.2.2 / **NSR-10** Tabla C.9.5(b) | Elementos que soportan o están ligados a muros divisorios de mampostería no estructural u acabados susceptibles a fisuración. |
| **$L/600$** | **AISC** Design Guide 3 (Sección 4.2) | Vigas de fachada o perimetrales que soportan sistemas vidriados o muros de albañilería a la vista. |

