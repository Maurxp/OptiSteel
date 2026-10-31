# OptiSteel 2.0 — Auditoría de Seguridad, Dependencias y Configuración de Producción

**Fecha:** 30 de Octubre de 2026  
**Fase:** P3.4  
**Evaluador:** Auditoría de Software Científico y Seguridad de Aplicaciones  

---

## 1. Resumen Ejecutivo de Seguridad

OptiSteel 2.0 fue auditado exhaustivamente en cinco dimensiones críticas:
1. Análisis de dependencias directas y transitivas con `pnpm audit`.
2. Clasificación de vulnerabilidades y discriminación de entornos (Producción vs. Desarrollo).
3. Seguridad de Frontend (XSS, inyección HTML, sanitización y Content Security Policy).
4. Seguridad del repositorio (ausencia de credenciales, secretos incrustados y archivos sensibles).
5. Configuración de despliegue y automatización CI/CD (permisos mínimos en GitHub Actions y cabeceras HTTP en Cloudflare Pages).

**Veredicto General:** **APROBADO PARA PRODUCCIÓN**. La aplicación empaquetada para el usuario final no contiene dependencias vulnerables en tiempo de ejecución. Las advertencias de seguridad identificadas corresponden exclusivamente a herramientas de desarrollo y ejecución de pruebas locales (`devDependencies`).

---

## 2. Auditoría y Clasificación de Dependencias (`pnpm audit`)

La ejecución de `npx pnpm audit` reportó 6 avisos de seguridad (2 críticos y 4 moderados). A continuación se clasifica técnicamente cada uno, analizando su alcance y vector de ataque:

| Paquete | Versión Instalada | Severidad | Identificador | Vector / Alcance | Exposición en Producción | Decisión Técnica |
| :--- | :---: | :---: | :---: | :--- | :---: | :--- |
| **`tinypool`** | `1.1.1` | **Crítica** | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) | Prototype Pollution en opciones de workers que conduce a RCE durante la ejecución paralela de tests. | **NULA (0%)** | Dependencia transitiva de `vitest`. No se compila ni se incluye en el bundle web ni en el paquete `@optisteel/core`. Se documenta como riesgo residual en entorno de pruebas. |
| **`tinypool`** | `1.1.1` | **Crítica** | [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | Prototype Pollution en método `run()`. | **NULA (0%)** | Igual a la anterior. La corrección exige `tinypool >=2.1.2`, que es incompatible con `vitest 3.0.7`. |
| **`vitest`** | `3.0.7` | **Moderada** | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | Path Traversal / lectura arbitraria de archivos locales vía `@vitest/mocker`. | **NULA (0%)** | Solo explotable si un atacante suministra configuraciones de mock maliciosas al test runner local. No expuesto en producción. |
| **`@vitest/mocker`** | `3.0.7` | **Moderada** | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | Componente interno de Vitest para redirección de mocks. | **NULA (0%)** | Dependencia interna de pruebas. |
| **`@vitest/mocker`** | `3.0.7` | **Moderada** | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | Inyección de código en registro de mocks no autenticado. | **NULA (0%)** | Igual a la anterior. Parche disponible únicamente a partir de Vitest 4.x (versión mayor no lanzada en canal estable). |
| **`vite`** | `6.4.4` | **Moderada** | [GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj) | `server.fs.deny` evadible mediante queries en el servidor dev local. | **NULA (0%)** | Afecta únicamente al servidor de desarrollo local (`pnpm dev`). No afecta a Cloudflare Pages, donde se sirven exclusivamente archivos estáticos precompilados. Parche aún no publicado upstream por el equipo de Vite. |

### Justificación de no actualización forzada:
En estricta observancia de las reglas de estabilidad del proyecto, **no se aplicó `pnpm audit fix --force` ni se forzaron saltos de versión mayor**. Forzar Vitest a versiones 4.x rompería la compatibilidad de las 223 pruebas existentes. Los avisos no comprometen la seguridad del usuario final en la web ni del motor core.

---

## 3. Seguridad de Frontend y Código Fuente

1. **Inyección HTML y XSS:**
   - La búsqueda en todo el código fuente de `apps/web/src` de métodos inseguros (`dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`) confirmó **cero (0) ocurrencias**.
   - Toda la renderización de texto y fórmulas en la interfaz utiliza el Virtual DOM de React 19, el cual aplica escape automático de caracteres especiales por defecto.
2. **Entradas de Usuario y Validación de Tipos:**
   - Todas las entradas del usuario (longitudes, posiciones, cargas, denominadores) son parseadas estrictamente con `parseFloat` / `Number` y saneadas contra `NaN` y valores finitos.
   - El motor [`validator.ts`](file:///c:/Users/amaur/Desktop/OptiSteelProject/packages/core/src/validator.ts) valida rangos numéricos positivos y rechaza configuraciones inestables antes de cualquier cálculo.
3. **Almacenamiento Local:**
   - La aplicación no almacena credenciales, tokens ni datos personales en `localStorage` o `sessionStorage`.

---

## 4. Seguridad de Repositorio y Secretos

1. **Inspección de Secretos y Credenciales:**
   - Se ejecutó un escaneo con expresiones regulares sobre el historial y árbol de trabajo (`api_key`, `secret_key`, `private_key`, `token`, `password`), confirmando **cero secretos incrustados**.
2. **Archivos de Entorno:**
   - No existen archivos `.env` versionados ni presentes en el espacio de trabajo.
   - `.gitignore` excluye taxativamente `.env`, `.venv/`, `venv/`, `node_modules/`, `dist/` y `Resist Mat. SINGER (1).pdf`.
3. **Protección de Datos:**
   - El catálogo `perfiles_estructurales.csv` se mantiene con permisos de solo lectura conceptual y no ha sido alterado.

---

## 5. Seguridad en Despliegue y CI/CD

1. **GitHub Actions (`.github/workflows/ci.yml`):**
   - Principio de privilegios mínimos: `permissions: contents: read`.
   - Sin acceso a tokens con permisos de escritura ni exposición de secretos a pull requests bifurcados (forks).
   - Acciones oficiales de GitHub fijadas en versiones mayores estables (`actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`).
   - Timeout explícito configurado a 15 minutos para prevenir consumo descontrolado de minutos de cómputo.
   - Concurrencia controlada para cancelar ejecuciones redundantes en ramas de trabajo.
2. **Cloudflare Pages (`apps/web/public/_headers`):**
   - Se implementaron cabeceras HTTP de seguridad para producción:
     - `X-Frame-Options: DENY` (Mitiga ataques de Clickjacking).
     - `X-Content-Type-Options: nosniff` (Previene ataques de confusión de tipo MIME).
     - `Referrer-Policy: strict-origin-when-cross-origin`.
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (Fuerza HTTPS estricto).
     - `Content-Security-Policy`: Restringe la carga de scripts e imágenes exclusivamente al propio dominio (`'self'`).

