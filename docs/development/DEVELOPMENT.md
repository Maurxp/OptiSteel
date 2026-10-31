# OptiSteel 2.0 — Guía para Desarrolladores y Contribución

Esta guía documenta los estándares de desarrollo, flujos de trabajo, convenciones técnicas y procedimientos para extender las capacidades de **OptiSteel 2.0**.

---

## 1. Configuración del Entorno de Desarrollo

### 1.1. Requisitos Previos
* **Node.js:** Versión LTS recomendada `^22.14.0` (admitido rango `>=20.18.0 <=24.x`).
* **pnpm:** Versión `>=9.0.0` (compatible con v9, v10 y v12).
* **Git:** Para control de versiones.

### 1.2. Instalación
```bash
git clone https://github.com/Maurxp/OptiSteel.git
cd OptiSteel

# Instalación estricta de dependencias con lockfile congelado
pnpm install --frozen-lockfile
```

### 1.3. Comandos de Trabajo Diario
```bash
# Servidor de desarrollo con recarga en caliente (Hot Module Replacement)
pnpm dev

# Verificación de tipos estáticos en todo el monorepo
pnpm typecheck

# Ejecución de la suite completa de pruebas (Core + Web)
pnpm test

# Compilación de producción
pnpm build
```

---

## 2. Convenciones de Código y Estándares

### 2.1. Estilo y Lenguaje
* **Lenguaje:** TypeScript 5.8 estricto (`strict: true`, `noImplicitAny: true`).
* **Módulos:** ECMAScript Modules (`"type": "module"`). Todos los imports relativos en el código fuente de TypeScript deben usar la extensión `.js` (ej. `import { foo } from './foo.js'`).
* **Nombres:**
  * Variables y funciones: `camelCase` (ej. `calculateBendingStress`).
  * Tipos e Interfaces: `PascalCase` (ej. `BeamAnalysisResult`).
  * Constantes: `UPPER_SNAKE_CASE` (ej. `LENGTH_TOLERANCE`).
  * Archivos fuente: `kebab-case.ts` (ej. `continuous-beam.ts`).

### 2.2. Unidades Físicas Obligatorias
Todas las funciones internas de cálculo deben trabajar estrictamente en las siguientes unidades canónicas:
* Coordenadas y longitudes: Metros ($\text{m}$).
* Fuerzas puntuales y reacciones: Kilonewtons ($\text{kN}$).
* Cargas distribuidas: Kilonewtons por metro ($\text{kN/m}$).
* Momentos flectores y torsores: Kilonewton-metro ($\text{kN}\cdot\text{m}$).
* Módulo de elasticidad ($E$): Gigapascales ($\text{GPa}$).
* Inercia seccional ($I_z$): Centímetros a la cuarta ($\text{cm}^4$).
* Módulo de sección ($W_z$ o $S$): Centímetros cúbicos ($\text{cm}^3$).
* Esfuerzos ($\sigma, \tau$): Megapascales ($\text{MPa} = \text{N/mm}^2$).
* Deflexiones en reporte: Milímetros ($\text{mm}$).

### 2.3. Convenciones de Signos
* Cargas verticales externas: Positivas hacia abajo ($\downarrow$).
* Reacciones verticales: Positivas hacia arriba ($\uparrow$).
* Momentos externos concentrados: Positivos en sentido antihorario ($\circlearrowleft$).
* Relación diferencial de equilibrio interno:
  $$\frac{dV}{dx} = -w(x), \qquad \frac{dM}{dx} = V(x)$$
* Ecuación diferencial de curvatura elástica:
  $$EI \frac{d^2 v}{dx^2} = -M(x)$$

---

## 3. Procedimientos para Extender el Sistema

### 3.1. Añadir un Nuevo Modelo Estructural o Solver
1. **Definir el modelo en el Validador:**
   - Modifique [`packages/core/src/validator.ts`](file:///c:/Users/amaur/Desktop/OptiSteelProject/packages/core/src/validator.ts) para reconocer la configuración de apoyos y cargas correspondiente.
2. **Implementar el Solver Analítico:**
   - Si es hiperestático, cree el módulo en `packages/core/src/hyperstatic/` implementando la compatibilidad elástica y retornando un `BeamAnalysisResult`.
   - Implemente la función de reporte didáctico en `packages/core/src/hyperstatic/didactic.ts`.
3. **Conectar en el Router Central:**
   - Enlace el nuevo solver en [`packages/core/src/analyzer.ts`](file:///c:/Users/amaur/Desktop/OptiSteelProject/packages/core/src/analyzer.ts#L41) dentro de `analyzeBeam()`.
4. **Añadir Pruebas Unitarias de Regresión:**
   - Agregue casos de prueba en `packages/core/tests/hyperstatic-solver.test.ts` contrastando reacciones, momentos y deflexiones frente a soluciones teóricas de la literatura técnica.

### 3.2. Añadir un Nuevo Caso a la Biblioteca Pytel-Singer
1. **Catalogar en Core:**
   - Edite `packages/core/src/pytel-singer/catalog.ts`.
   - Añada la definición al arreglo `PYTEL_SINGER_CASES` implementando `createModel(params)` y `evaluateTheoretical(params, EI)`.
2. **Validar la Solución Analítica:**
   - Añada el caso en `packages/core/tests/pytel-singer-all-12-cases.test.ts` comparando los resultados numéricos del motor frente a las fórmulas algebraicas de Singer.
3. **Actualizar la Interfaz Web:**
   - Si requiere filtros adicionales, verifique la categorización en `apps/web/src/components/PytelSingerLibrary.tsx`.

### 3.3. Trabajar en el Módulo de Mecánica de Materiales
* Los cálculos de flexión residen en `packages/core/src/mechanics/bending.ts`.
* Los cálculos de cortante residen en `packages/core/src/mechanics/shear.ts`.
* La ecuación de la curva elástica reside en `packages/core/src/mechanics/elastic-curve.ts`.
* La evaluación de deflexiones y ELS por vanos reside en `packages/core/src/mechanics/deflection.ts`.
* **Regla de Oro:** Siempre que agregue o modifique un cálculo seccional, asegúrese de documentar las hipótesis geométricas y no asumir factores empíricos arbitrarios sin datos seccionales suficientes.

### 3.4. Modificar el Selector de Perfiles de Acero
* El motor de selección reside en `packages/core/src/steel-design/selector.ts`.
* La lectura del catálogo utiliza `packages/core/src/steel-design/catalog.ts`.
* **Regla Crítica:** Nunca altere `perfiles_estructurales.csv`. Si necesita añadir soporte para nuevas propiedades geométricas, modifique la interfaz `SteelProfile` en `packages/core/src/steel-design/types.ts` y actualice el parser CSV conservando la retrocompatibilidad con los campos existentes.

---

## 4. Política de Commits y Control de Versiones

OptiSteel 2.0 utiliza el estándar **Conventional Commits** con descripciones en **español**:

* `feat(módulo): descripción de la nueva característica`
* `fix(módulo): corrección de defecto o discrepancia`
* `docs(alcance): adición o actualización documental`
* `test(alcance): adición o ajuste de pruebas unitarias/integración`
* `refactor(módulo): refactorización interna sin cambio de comportamiento`
* `chore(alcance): tareas de mantenimiento, dependencias o CI`

**Regla de Seguridad:** Ningún commit debe incluir credenciales, secretos, archivos temporales ni modificaciones en los archivos protegidos (`perfiles_estructurales.csv` y `Resist Mat. SINGER (1).pdf`).
