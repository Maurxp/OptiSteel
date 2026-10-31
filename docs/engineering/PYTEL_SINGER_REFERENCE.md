# OptiSteel 2.0 — Biblioteca Académica Canónica (Pytel & Singer)

## 1. Contexto Académico y Origen

La biblioteca canónica de OptiSteel 2.0 compila las 12 configuraciones fundamentales de vigas de la **Tabla 6-2** (*Vigas con Cargas Típicas: Reacciones, Momentos y Deflexiones*) del texto clásico:

> **Pytel, Andrew & Singer, Ferdinand L.**  
> *Resistencia de Materiales*, 4.ª Edición (pp. 218–219). Editorial Harla.

---

## 2. Naturaleza Simbólica vs. Valores Numéricos

> [!NOTE]
> **DELIMITACIÓN DIDÁCTICA Y TRANSPARENCIA:**  
> 1. **Soluciones Originales Simbólicas:** En el libro de texto de Pytel y Singer, las soluciones de los 12 casos están formuladas de manera estrictamente algebraica en términos de parámetros simbólicos ($L, w, P, M, a, b$) y rigidez flexionante constante ($EI$).
> 2. **Perfil $W10\times30$ como Sección de Prueba:** Para permitir que el estudiante o ingeniero transfiera directamente un caso canónico al analizador interactivo y observe de inmediato los diagramas numéricos de cortante, momento, elástica y esfuerzos en megapascales, OptiSteel 2.0 preasigna un perfil de acero estándar $W10\times30$ ($I_z = 7076\text{ cm}^4, W_z = 434\text{ cm}^3, d = 267\text{ mm}, t_w = 7.6\text{ mm}$) con material $E = 200\text{ GPa}$.
> 3. **Carácter Ilustrativo:** Los valores de esfuerzo ($\sigma$ y $\tau$) y deflexión en milímetros calculados con dicha sección son una **propuesta ilustrativa generada por OptiSteel**, y **no forman parte del enunciado original de los problemas del libro**. El usuario tiene plena libertad de modificar las dimensiones, cargas o sección en el formulario interactivo.

---

## 3. Catálogo de los 12 Casos Canónicos

| Caso | Tipología de Viga | Condición de Carga | Fórmula Analítica del Momento Máximo | Fórmula Analítica de la Deflexión Máxima |
| :---: | :--- | :--- | :---: | :---: |
| **1** | Voladizo (Cantilever) | Carga puntual en el extremo libre ($x=L$) | $M_{\text{máx}} = -P L$ | $\delta_{\text{máx}} = \frac{P L^3}{3EI}$ (en extremo libre) |
| **2** | Voladizo (Cantilever) | Carga puntual intermedia a distancia $a$ | $M_{\text{máx}} = -P a$ | $\delta_{\text{máx}} = \frac{P a^2}{6EI}(3L - a)$ (en extremo libre) |
| **3** | Voladizo (Cantilever) | Carga uniformemente distribuida completa | $M_{\text{máx}} = -\frac{w L^2}{2}$ | $\delta_{\text{máx}} = \frac{w L^4}{8EI}$ (en extremo libre) |
| **4** | Voladizo (Cantilever) | Carga uniforme parcial desde el empotramiento | $M_{\text{máx}} = -\frac{w a^2}{2}$ | $\delta_{\text{máx}} = \frac{w a^3}{24EI}(4L - a)$ (en extremo libre) |
| **5** | Voladizo (Cantilever) | Carga triangular con vértice en extremo y máx en apoyo | $M_{\text{máx}} = -\frac{w_0 L^2}{6}$ | $\delta_{\text{máx}} = \frac{w_0 L^4}{30EI}$ (en extremo libre) |
| **6** | Voladizo (Cantilever) | Momento concentrado $M_0$ en el extremo libre | $M_{\text{máx}} = -M_0$ | $\delta_{\text{máx}} = \frac{M_0 L^2}{2EI}$ (en extremo libre) |
| **7** | Simplemente Apoyada | Carga puntual concentrada en el centro del vano | $M_{\text{máx}} = +\frac{P L}{4}$ | $\delta_{\text{máx}} = \frac{P L^3}{48EI}$ (en el centro) |
| **8** | Simplemente Apoyada | Carga uniformemente distribuida completa | $M_{\text{máx}} = +\frac{w L^2}{8}$ | $\delta_{\text{máx}} = \frac{5 w L^4}{384EI}$ (en el centro) |
| **9** | Simplemente Apoyada | Carga puntual excéntrica (distancias $a$ y $b$) | $M_{\text{máx}} = +\frac{P a b}{L}$ (en $x=a$) | $\delta_{\text{máx}} = \frac{P b (L^2 - b^2)^{3/2}}{9\sqrt{3} EIL}$ ($a \ge b$) |
| **10** | Simplemente Apoyada | Dos cargas simétricas iguales $P$ a distancia $a$ | $M_{\text{máx}} = +P a$ (en tramo central) | $\delta_{\text{máx}} = \frac{P a}{24EI}(3L^2 - 4a^2)$ (en el centro) |
| **11** | Simplemente Apoyada | Carga triangular simétrica con pico central $w_0$ | $M_{\text{máx}} = +\frac{w_0 L^2}{12}$ | $\delta_{\text{máx}} = \frac{w_0 L^4}{120EI}$ (en el centro) |
| **12** | Simplemente Apoyada | Momento concentrado $M_0$ en el extremo izquierdo | $M_{\text{máx}} = -M_0$ | $\delta_{\text{máx}} = \frac{M_0 L^2}{9\sqrt{3} EI}$ (en $x = L/\sqrt{3}$) |

---

## 4. Validación Automatizada en el Monorepo

En el paquete `@optisteel/core`, el archivo de pruebas [`packages/core/tests/pytel-singer-all-12-cases.test.ts`](file:///c:/Users/amaur/Desktop/OptiSteelProject/packages/core/tests/pytel-singer-all-12-cases.test.ts) valida automáticamente cada uno de estos 12 casos. Para cada prueba:
1. Se instancia el modelo estructural numérico con valores aleatorios o típicos de $L, P, w, a$.
2. Se ejecuta el análisis completo mediante `analyzeBeam(model)`.
3. Se evalúa la solución algebraica teórica del catálogo mediante `evaluateTheoretical(params, EI)`.
4. Se verifica que las reacciones, el momento flector máximo y la deflexión máxima coincidan con una tolerancia menor al $0.01\%$.

