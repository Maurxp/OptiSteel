# OptiSteel 2.0 — Fundamento Teórico de Resistencia de Materiales y ELS

Este documento describe la formulación analítica implementada en el módulo [`packages/core/src/mechanics`](file:///c:/Users/amaur/Desktop/OptiSteelProject/packages/core/src/mechanics) de OptiSteel 2.0, el cual procesa los resultados del solver estático para entregar los estados tensionales, deformacionales y de servicio de la viga.

---

## 1. Esfuerzo Normal por Flexión (Fórmula de Navier)

Para vigas elásticas prismáticas sometidas a flexión pura o combinada con cortante, se adopta la hipótesis cinemática de **Euler-Bernoulli** (las secciones planas antes de la deformación permanecen planas y ortogonales al eje neutro deformado).

### 1.1. Ecuación Gobernante
$$\sigma(x, y) = -\frac{M(x) \cdot y}{I_z}$$
donde:
* $M(x)$ es el momento flector en la sección $x$.
* $y$ es la distancia vertical medida desde el eje neutro baricéntrico (positivo hacia arriba).
* $I_z$ es el momento de inercia baricéntrico respecto al eje de flexión.

En la fibra más alejada ($|y| = c$):
$$\sigma_{\text{máx}}(x) = \frac{|M(x)| \cdot c}{I_z} = \frac{|M(x)|}{W_z}$$
donde $W_z = I_z / c$ es el **módulo de sección elástico**.

### 1.2. Evaluación de Extremos Duales de Momento ($M^+$ y $M^-$)
En elementos continuos e hiperestáticos (ej. Casos H3 y H4), la viga presenta simultáneamente zonas sometidas a momentos positivos y zonas sometidas a momentos negativos. OptiSteel 2.0 evalúa de forma independiente ambos extremos:

1. **Extremo de Flexión Positiva ($M^+ > 0$, Momento Sagante):**
   - Curvatura cóncava hacia arriba.
   - **Fibra superior:** Estado de **Compresión** ($\sigma < 0$).
   - **Fibra inferior:** Estado de **Tracción** ($\sigma > 0$).
   - Esfuerzo en fibra extrema: $\sigma^+ = \frac{M^+}{W_z}$.
2. **Extremo de Flexión Negativa ($M^- < 0$, Momento Hogante):**
   - Curvatura convexa hacia arriba.
   - **Fibra superior:** Estado de **Tracción** ($\sigma > 0$).
   - **Fibra inferior:** Estado de **Compresión** ($\sigma < 0$).
   - Esfuerzo en fibra extrema: $\sigma^- = \frac{|M^-|}{W_z}$.
3. **Esfuerzo Gobernante de Diseño Seccional:**
   Para secciones simétricas y materiales con igual resistencia admisible a tracción y compresión, el esfuerzo máximo gobernante se rige por el valor absoluto:
   $$\sigma_{\text{gob}} = \frac{\max(|M^+|, |M^-|)}{W_z}$$

---

## 2. Esfuerzo Cortante Seccional

El cortante transversal genera esfuerzos tangenciales $\tau$ en la sección. OptiSteel clasifica y reporta rigurosamente el método de cálculo según la geometría disponible:

### 2.1. Cortante Promedio Global ($\tau_{\text{prom}}$)
Cuando únicamente se dispone del área bruta transversal $A$ (sin cotas detalladas):
$$\tau_{\text{prom}} = \frac{|V|}{A}$$
> [!NOTE]
> OptiSteel **nunca** reporta este valor promedio como cortante máximo real, advirtiendo al usuario de la ausencia de dimensiones para aplicar Jourawski.

### 2.2. Cortante Medio en el Alma ($\tau_{\text{alma}}$ — AISC 360 / NSR-10)
Para perfiles estructurales de acero tipo I o W donde se suministra el peralte total $d$ y el espesor del alma $t_w$:
$$\tau_{\text{alma}} = \frac{|V|}{d \cdot t_w}$$
En perfiles laminados en caliente, el alma absorbe entre el 90% y el 98% del cortante transversal total, siendo esta la base del dimensionamiento estándar en códigos de construcción.

### 2.3. Cortante Máximo Elástico de Jourawski / Colignon ($\tau_{\text{máx}}$)
Cuando se dispone de la geometría completa del perfil I/W (ancho de ala $b_f$, espesor de ala $t_f$, peralte $d$, espesor de alma $t_w$ e inercia $I_z$), se aplica la formulación elástica exacta:
$$\tau(y) = \frac{|V| \cdot Q(y)}{I_z \cdot b(y)}$$
El esfuerzo cortante máximo se presenta en el **eje neutro baricéntrico** ($y = 0$), donde el primer momento de área $Q_{\text{máx}}$ alcanza su valor pico:
$$Q_{\text{máx}} = Q_{\text{alas}} + Q_{\text{alma}} = \left(b_f \cdot t_f \cdot \frac{d - t_f}{2}\right) + \left(t_w \cdot \frac{(d - 2t_f)^2}{8}\right)$$
$$\tau_{\text{máx}} = \frac{|V| \cdot Q_{\text{máx}}}{I_z \cdot t_w}$$
En la interfaz de OptiSteel, este valor se rotula expresamente como:  
`τmáx — Jourawski en eje neutro`.

### 2.4. Secciones Sólidas Canónicas
* **Sección Rectangular Maciza ($b \times h$):**  
  Distribución parabólica con valor nulo en las caras superior e inferior y máximo en el eje neutro:
  $$\tau_{\text{máx}} = \frac{3}{2} \cdot \frac{|V|}{b \cdot h} = 1.5 \cdot \tau_{\text{prom}}$$
* **Sección Circular Maciza (Diámetro $D$):**
  $$\tau_{\text{máx}} = \frac{4}{3} \cdot \frac{|V|}{A} = \frac{4}{3} \cdot \tau_{\text{prom}}$$

---

## 3. Ecuación Diferencial de la Curva Elástica

### 3.1. Formulación de Euler-Bernoulli
La deformación transversal elástica $v(x)$ satisface la ecuación diferencial de cuarto orden:
$$\frac{d^2}{dx^2}\left(EI \frac{d^2 v}{dx^2}\right) = w(x)$$
Integrando dos veces mediante la ley de momentos flectores internos:
$$EI \frac{d^2 v(x)}{dx^2} = -M(x)$$
$$EI \theta(x) = EI \frac{dv(x)}{dx} = -\int M(x) \, dx + C_1$$
$$EI v(x) = -\iint M(x) \, dx^2 + C_1 x + C_2$$

### 3.2. Condiciones de Frontera Físicas
Las constantes de integración $C_1$ y $C_2$ se determinan unívocamente a partir de los apoyos físicos:
* **Apoyo Simple (Pin o Roller en $x_0$):** Restricción cinemática de desplazamiento $v(x_0) = 0$.
* **Empotramiento Rígido (Fixed en $x_0$):** Restricciones de desplazamiento $v(x_0) = 0$ y rotación nula $\theta(x_0) = v'(x_0) = 0$.

---

## 4. Estado Límite de Servicio (ELS) y Verificación por Vanos

### 4.1. Partición Topológica de la Viga
En vigas continuas o con voladizos, la longitud total del elemento $L_{\text{total}}$ no representa la distancia física entre apoyos. OptiSteel 2.0 ejecuta el algoritmo `extractBeamSpans` para disgregar la viga en sectores físicos:
1. Voladizo izquierdo: $[0, x_{\text{apoyo 1}}]$.
2. Vanos interiores entre apoyos consecutivos: $[x_i, x_{i+1}]$.
3. Voladizo derecho: $[x_{\text{último apoyo}}, L_{\text{total}}]$.

### 4.2. Límites Admisibles por Sector
* **Tramos Interiores entre Apoyos:**
  $$\delta_{\text{adm}} = \frac{L_{\text{span}}}{n}$$
  donde $L_{\text{span}}$ es la luz libre del vano específico y $n$ es el denominador de servicio (predeterminado en 360).  
  *Ejemplo:* En la viga continua H4 simétrica de $L = 10\text{ m}$ ($L_{\text{span}} = 5\text{ m}$), cada vano se verifica contra $\frac{5000\text{ mm}}{360} = 13.89\text{ mm}$, **nunca** contra los $27.78\text{ mm}$ de la longitud total.
* **Tramos en Voladizo (Criterio de Viga Simétrica Equivalente):**
  $$\delta_{\text{adm}} = \frac{2 \cdot a}{n} = \frac{a}{n / 2}$$
  donde $a$ es la longitud del voladizo.

### 4.3. Documentación del Criterio de Voladizos ($2a/n$)
> [!NOTE]
> **Fundamentación Teórica y Decisión de Producto:**
> 1. **Origen Analítico:** Una viga en voladizo de longitud $a$ posee giro nulo en el empotramiento ($\theta = 0$). Este comportamiento elástico coincide con la mitad de una viga simplemente apoyada continua de luz doble $L_{\text{equiv}} = 2a$, donde el giro en el centro es nulo por simetría.
> 2. **Adopción en Normas:** Diversos códigos como el **IBC (Tabla 1604.3, Nota f)** estipulan que para voladizos la luz $l$ se toma como dos veces la longitud del voladizo.
> 3. **Decisión de Producto de OptiSteel:** La fórmula $\delta_{\text{adm}} = \frac{2a}{n}$ se adopta como el modelo elástico canónico predeterminado en el software. Dado que diferentes especificaciones de proyectos pueden requerir límites más rigurosos, en futuras revisiones (Fase P3+) se considerará habilitar la configuración del divisor independiente para voladizos en la interfaz.

