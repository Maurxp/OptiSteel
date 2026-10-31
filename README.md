# OptiSteel 2.0 🏗️

> **Plataforma Web y Motor de Cálculo para Análisis Estructural, Mecánica de Materiales y Dimensionamiento de Perfiles de Acero**
> Desarrollado en TypeScript sobre arquitectura Monorepo moderna, con formulación elástica rigurosa basada en *Resistencia de Materiales* (Pytel & Singer, 4.ª Ed.) y verificaciones preliminares de servicio y resistencia según normativas internacionales (**AISC 360**, **NSR-10 Título F**, **IBC**).

[![Node.js Version](https://img.shields.io/badge/Node.js-22%20LTS%20%7C%2024-brightgreen.svg)](https://nodejs.org/)
[![pnpm Workspace](https://img.shields.io/badge/pnpm-Workspace-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-purple.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-223%20passed-success.svg)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 📌 Descripción General

**OptiSteel 2.0** es una solución integral de ingeniería civil y estructural diseñada para el análisis analítico de vigas continuas, la resolución didáctica de sistemas hiperestáticos canónicos, el cálculo riguroso de esfuerzos elásticos seccionales y la selección preliminar óptima de perfiles estructurales de acero laminado en caliente.

El proyecto está concebido con un estándar industrial desacoplado:
1. **`@optisteel/core`**: Motor matemático y analítico independiente en TypeScript puro, sin dependencias de DOM ni navegador, ejecutable en Node.js, navegadores o entornos serverless.
2. **`@optisteel/web`**: Aplicación web interactiva en React 19 y Vite con esquemas SVG paramétricos, trazado reactivo de diagramas tensionales, biblioteca canónica y reporte didáctico de compatibilidad elástica.

---

## ✨ Características Principales

### 1. Análisis Estructural y Equilibrio Estático
* **Sistemas Isostáticos Generales:** Vigas simplemente apoyadas, vigas en voladizo (cantilever) y vigas con voladizos extremos.
* **Casos Hiperestáticos Canónicos H1–H4:**
  * **H1:** Viga empotrada-apoyada con carga puntual excéntrica o central.
  * **H2:** Viga empotrada-apoyada con carga uniformemente distribuida.
  * **H3:** Viga biempotrada con carga uniformemente distribuida completa.
  * **H4:** Viga continua de dos vanos con apoyo intermedio y carga distribuida uniforme.
* **Resolución Analítica Cerrada:** Cálculo exacto de reacciones mediante equilibrio estático y ecuaciones de compatibilidad geométrica elástica.
* **Diagramas Continuos por Tramos:** Funciones continuas a trozos para esfuerzo cortante $V(x)$ y momento flector $M(x)$.
* **Puntos Críticos y Notables:** Detección de singularidades, cortes por cero en $V(x)$, extremos locales y globales, y puntos de inflexión ($M=0$).

### 2. Módulo de Resistencia de Materiales
* **Esfuerzo Normal por Flexión (Navier):**
  $$\sigma = \frac{|M| \cdot c}{I_z} = \frac{|M|}{W_z}$$
  Evaluación simultánea de los extremos duales de flexión positiva ($M^+$, sagante con tracción inferior y compresión superior) y negativa ($M^-$, hogante con tracción superior y compresión inferior).
* **Esfuerzo Cortante Seccional:**
  * Cortante medio global: $\tau_{\text{prom}} = \frac{|V|}{A}$.
  * Cortante medio en el alma (AISC / NSR-10): $\tau_{\text{alma}} = \frac{|V|}{d \cdot t_w}$.
  * Cortante máximo elástico de **Jourawski / Colignon** en el eje neutro para perfiles I/W con dimensiones completas:
    $$\tau_{\text{máx}} = \frac{|V| \cdot Q_{\text{máx}}}{I_z \cdot t_w}$$
  * Distribución parabólica en rectángulos macizos ($\tau_{\text{máx}} = 1.5 \cdot \tau_{\text{prom}}$) y círculos ($\tau_{\text{máx}} = \frac{4}{3} \cdot \tau_{\text{prom}}$).
* **Ecuación Analítica de la Curva Elástica (Euler-Bernoulli):**
  $$EI \frac{d^2 v}{dx^2} = -M(x)$$
  Despliegue de constantes de integración ($C_1, C_2$), condiciones de frontera y ecuaciones polinómicas exactas $v(x)$ y $\theta(x)$ por cada tramo.
* **Evaluación del Estado Límite de Servicio (ELS) por Vanos:**
  Partición topológica automática de vanos entre apoyos y voladizos, evaluando cada vano según su propia longitud de referencia ($L_{\text{span}}/n$) y los voladizos según el criterio analítico de viga simétrica equivalente ($2a/n$), con denominador $n$ configurable (ej. 360, 240, 180).

### 3. Biblioteca Didáctica Pytel & Singer
* **12 Casos Canónicos:** Basada en la Tabla 6-2 de la 4.ª edición de *Resistencia de Materiales* de Andrew Pytel y Ferdinand L. Singer.
* **Transferencia Inmediata:** Carga paramétrica directa de cualquier caso de libro de texto al motor de análisis.
* **Transparencia Didáctica:** Clarificación de que los problemas originales del libro son de formulación simbólica en función de $EI$; el perfil preasignado $W10\times30$ es una propuesta ilustrativa de prueba editable por el usuario.

### 4. Selector Óptimo de Perfiles de Acero
* **Base de Datos Estructural:** Integración del catálogo estándar con perfiles comerciales **W (Wide Flange)**, **S (American Standard)** y **C (Channels)**.
* **Iteración Automática de Peso Propio:** Incorpora el incremento gravitacional del peso del perfil ($w_{pp} = m \cdot g$) recalculando esfuerzos y deflexiones en cada candidato.
* **Filtros por Familia y Eficiencia:** Clasificación ordenada por masa lineal ($\text{kg/m}$) para garantizar la solución de menor costo de material.

---

## 🏛️ Arquitectura del Monorepo

```text
OptiSteelProject/
├── packages/
│   └── core/                      # Motor analítico TypeScript (@optisteel/core)
│       ├── src/
│       │   ├── hyperstatic/       # Solvers H1, H2, H3, H4 y reporte didáctico
│       │   ├── mechanics/         # Postprocesador de Resistencia de Materiales
│       │   ├── pytel-singer/      # Biblioteca canónica y evaluadores teóricos
│       │   ├── steel-design/      # Selector de perfiles y modelos de sección
│       │   ├── analyzer.ts        # Orquestador unificado analyzeBeam()
│       │   ├── elasticity.ts      # Solver numérico de rigidez y elástica
│       │   ├── internal-forces.ts # Generación continua de V(x) y M(x)
│       │   ├── reactions.ts       # Equilibrio y cálculo de reacciones
│       │   └── validator.ts       # Validador de modelos y estabilidad
│       └── tests/                 # Batería de 174 pruebas unitarias de core
│
├── apps/
│   └── web/                       # Aplicación React 19 + Vite (@optisteel/web)
│       ├── src/
│       │   ├── components/        # UI: Schematics, Results, Panel Mecánica, Forms
│       │   ├── adapters/          # Mapeadores de estado UI a BeamModel
│       │   └── types/             # Tipado extendido de interfaz
│       └── tests/                 # 49 pruebas de integración UI y responsive
│
├── docs/                          # Documentación técnica y de ingeniería
│   ├── architecture/              # Guías de diseño y diagramas Mermaid
│   ├── development/               # Guía para desarrolladores y estándares
│   ├── deployment/                # Guía de despliegue en Cloudflare Pages
│   └── engineering/               # Fundamento matemático, normativo y convenciones
│
├── perfiles_estructurales.csv     # Catálogo de perfiles comerciales (protegido)
├── tsconfig.base.json             # Configuración base de TypeScript 5.8
├── pnpm-workspace.yaml            # Definición del workspace pnpm
└── package.json                   # Scripts y configuración raíz
```

---

## 🚀 Requisitos de Entorno e Instalación

### Requisitos Previos
* **Node.js:** Versión LTS recomendada `^22.14.0` (compatible con `Node.js >=20.18.0 <=24.x`).
* **pnpm:** Gestor de paquetes recomendado `pnpm >=9.0.0` (compatible con v9, v10 y v12).

### Instalación Rápida
```bash
# 1. Clonar el repositorio
git clone https://github.com/Maurxp/OptiSteel.git
cd OptiSteel

# 2. Instalar dependencias con lockfile inmutable
pnpm install --frozen-lockfile
```

---

## 💻 Comandos de Ejecución y Desarrollo

El monorepo centraliza los comandos en la raíz mediante scripts de pnpm:

| Comando | Descripción |
| :--- | :--- |
| `pnpm dev` | Inicia el servidor de desarrollo interactivo de `@optisteel/web` en [http://localhost:5173](http://localhost:5173) |
| `pnpm test` | Ejecuta las **223 pruebas** de la suite completa (Core y Web) con Vitest |
| `pnpm test:core` | Ejecuta exclusivamente las 174 pruebas unitarias de `@optisteel/core` |
| `pnpm test:web` | Ejecuta exclusivamente las 49 pruebas de integración de `@optisteel/web` |
| `pnpm typecheck` | Comprobación de tipos en todo el monorepo (`tsc --noEmit`) sin generar artefactos |
| `pnpm build` | Compila `@optisteel/core` (generando `.d.ts` y `.js`) y empaqueta `@optisteel/web` con Vite |
| `pnpm build:core` | Compila exclusivamente el paquete core |
| `pnpm build:web` | Compila y empaqueta exclusivamente la aplicación web para producción (`apps/web/dist`) |

---

## 📐 Convenciones Físicas y de Signos

OptiSteel 2.0 opera con unidades coherentes del **Sistema Internacional (SI)** adaptadas a la práctica de ingeniería estructural:

* **Longitud y cotas:** Metros ($\text{m}$).
* **Cargas puntuales ($P$):** Kilonewtons ($\text{kN}$). Positivas hacia abajo ($\downarrow$).
* **Cargas distribuidas ($w$):** Kilonewtons por metro ($\text{kN/m}$). Positivas hacia abajo ($\downarrow$).
* **Momentos concentrados externos ($M_0$):** Kilonewton-metro ($\text{kN}\cdot\text{m}$). Positivos antihorarios ($\circlearrowleft$).
* **Reacciones de apoyo ($R_y, M_r$):** Vertical positiva hacia arriba ($\uparrow$), momento de empotramiento positivo antihorario ($\circlearrowleft$).
* **Relaciones diferenciales internas:**
  $$\frac{dV}{dx} = -w(x), \qquad \frac{dM}{dx} = V(x)$$
* **Ecuación de curvatura elástica:**
  $$EI \frac{d^2 v}{dx^2} = -M(x)$$
  donde $v(x)$ es positivo hacia arriba ($\uparrow$) y el descenso físico (flecha) se reporta como $|v|$ hacia abajo ($\downarrow$).
* **Módulo de elasticidad ($E$):** Gigapascales ($\text{GPa}$).
* **Momento de inercia ($I_z$):** Centímetros a la cuarta ($\text{cm}^4$).
* **Esfuerzos ($\sigma, \tau$):** Megapascales ($\text{MPa} = \text{N/mm}^2$).

---

## ⚠️ Alcance Normativo y Descargo de Responsabilidad

> ### 📢 ADVERTENCIA PROFESIONAL
> **OptiSteel 2.0 es una herramienta científica, didáctica y de prediseño preliminar.**
>
> 1. **No sustituye la memoria de cálculo formal:** Los resultados generados no constituyen un proyecto estructural definitivo ni eximen de la revisión y firma por parte de un Ingeniero Civil / Estructural matriculado.
> 2. **Verificaciones Preliminares Elásticas:** El selector de perfiles implementa comprobaciones elásticas básicas de esfuerzo normal admisible ($\sigma \le \sigma_{\text{adm}}$) y cortante medio en alma ($\tau \le \tau_{\text{adm}}$). No efectúa el diseño completo bajo LRFD ni verifica exhaustivamente estados de pandeo lateral-torsional (PLT), pandeo local de alas/alma, interacciones biaxiales ni combinaciones de carga disgregadas ($1.2D + 1.6L$) según AISC 360 o NSR-10 Título F.
> 3. **Simetría Seccional:** La formulación de flexión de Navier asume simetría respecto al eje neutro baricéntrico ($c_{\text{sup}} = c_{\text{inf}} = h/2$).

Para una matriz exhaustiva de las cláusulas normativas implementadas y no implementadas, consulte [`docs/engineering/NORMATIVE_SCOPE.md`](./docs/engineering/NORMATIVE_SCOPE.md).

---

## 📚 Documentación Técnica Detallada

* 📐 [Convenciones y Unidades de Ingeniería](./docs/engineering/CONVENTIONS.md)
* 🏛️ [Modelos Estructurales e Hiperestáticos H1–H4](./docs/engineering/STRUCTURAL_MODELS.md)
* ⚡ [Módulo de Resistencia de Materiales y ELS](./docs/engineering/MATERIALS_MECHANICS.md)
* ⚖️ [Alcance Normativo y Matriz AISC / NSR-10 / IBC](./docs/engineering/NORMATIVE_SCOPE.md)
* 🧩 [Geometría Seccional y Limitaciones](./docs/engineering/CROSS_SECTIONS.md)
* 📖 [Biblioteca Académica Pytel & Singer](./docs/engineering/PYTEL_SINGER_REFERENCE.md)
* 🏗️ [Guía de Arquitectura del Monorepo](./docs/architecture/ARCHITECTURE.md)
* 🛠️ [Guía para Desarrolladores y Contribución](./docs/development/DEVELOPMENT.md)
* ☁️ [Guía de Despliegue en Cloudflare Pages](./docs/deployment/CLOUDFLARE_PAGES.md)

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulte el archivo [`LICENSE`](./LICENSE) para mayores detalles.
Copyright (c) 2026 Mauricio Perdomo.
