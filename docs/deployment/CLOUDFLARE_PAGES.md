# OptiSteel 2.0 — Guía de Despliegue en Cloudflare Pages

Esta guía detalla la configuración técnica, requerimientos de compilación y directivas de seguridad para el despliegue de **OptiSteel 2.0** en la plataforma **Cloudflare Pages**.

---

## 1. Configuración de Compilación en Cloudflare Pages

Cloudflare Pages se integra de manera nativa con el repositorio de GitHub mediante webhooks de Git. Cuando se realiza un push a la rama `main` o se abre un Pull Request, Cloudflare inicia un runner de compilación aislado.

### 1.1. Parámetros del Panel de Control (Cloudflare Dashboard)

| Parámetro | Valor de Configuración | Justificación |
| :--- | :--- | :--- |
| **Framework preset** | `Vite` (o `None / Custom`) | La aplicación web está empaquetada con Vite 6. |
| **Build command** | `pnpm build` | Ejecuta la compilación de `@optisteel/core` (`tsc`) y el empaquetado de `@optisteel/web` (`vite build`). |
| **Build output directory** | `apps/web/dist` | Directorio donde Vite genera los artefactos estáticos (`index.html`, assets CSS/JS). |
| **Root directory** | `/` (Raíz del repositorio) | Es indispensable ejecutar el build desde la raíz del monorepo para que pnpm resuelva el workspace y enlace `@optisteel/core`. |

### 1.2. Variables de Entorno de Compilación
En el panel de Cloudflare Pages (`Settings > Environment Variables`), configure las siguientes variables para entornos de **Production** y **Preview**:

* `NODE_VERSION`: `22` (garantiza el uso de Node.js 22 LTS, compatible con Vite 6 y TypeScript 5.8).
* `PNPM_VERSION`: `9.15.4` (o versión `>=9.0.0` para resolución de lockfile v9).

---

## 2. Enrutamiento SPA y Manejo de Rutas

Como aplicación de página única (Single Page Application, SPA), cualquier solicitud a subrutas directas debe servir el archivo `apps/web/dist/index.html`.

Cloudflare Pages maneja automáticamente el fallback a `index.html` cuando se selecciona el preset de Vite. Para garantizar la compatibilidad universal en caso de configuración manual, se provee el archivo de redirección en `apps/web/public/_redirects`:

```text
/*    /index.html   200
```

---

## 3. Cabeceras de Seguridad HTTP (`_headers`)

Para proteger la aplicación en producción contra vulnerabilidades comunes de frontend (Clickjacking, MIME-Sniffing, inyecciones de script), se define el archivo `apps/web/public/_headers`, el cual Cloudflare Pages inyecta automáticamente en todas las respuestas HTTP:

```text
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: svg+xml:; connect-src 'self';
```

---

## 4. Gestión de Ramas y Ambientes

1. **Producción (`Production Environment`):**
   - Vinculado a la rama `main`.
   - Cualquier push directo o merge de Pull Request aprobado hacia `main` desencadena la publicación en el dominio principal de producción.
2. **Previsualizaciones (`Preview Deployments`):**
   - Cada Pull Request abierto genera una URL temporal única de vista previa (`https://<hash>.<proyecto>.pages.dev`).
   - Permite verificar visualmente el comportamiento de la interfaz y la integración antes de autorizar el merge a `main`.

---

## 5. Procedimiento de Verificación Local Previsto

Antes de autorizar la publicación a Cloudflare Pages, ejecute localmente la simulación exacta del proceso de compilación:

```bash
# 1. Limpiar artefactos previos
pnpm -r build

# 2. Verificar que el directorio de salida existe y contiene index.html
test -f apps/web/dist/index.html && echo "Artefactos listos para producción"

# 3. Previsualizar localmente el build de producción
pnpm --filter @optisteel/web preview
```

