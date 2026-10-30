# Agente "Registro como Proveedor"

Agente conversacional que prepara el registro de Periferia como proveedor: lee la solicitud del cliente, llena el formulario desde el repositorio maestro, arma el paquete para firma y **deja la decisión final a una persona**. Nunca firma ni envía.

- Backend: Node 20+, TypeScript y NestJS 11.
- Herramientas tipadas con `zod`, separadas del servidor e importables sin modelo (`demo.ts`).
- Front de chat sin build (HTML + JS), servido por el mismo backend.
- Diseño completo y decisiones: [SOLUCION.md](./SOLUCION.md).

## Requisitos

- Node 20 o superior.
- Una clave de Anthropic (solo para el chat con modelo; `demo.ts` no la necesita).

## Levantar en local

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env y define ANTHROPIC_API_KEY
npm run dev               # http://localhost:3000
```

El servidor lee `.env` al arrancar y limpia `out/`.

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `anthropic`, `openai` (cualquier API compatible con OpenAI, incluidas opciones gratuitas) o `mock` (**solo pruebas**, sin clave). |
| `ANTHROPIC_API_KEY` | – | Clave de Anthropic (con `LLM_PROVIDER=anthropic`). Solo en el backend; nunca llega al front, a los logs ni a la API. |
| `LLM_BASE_URL` | – | URL base de la API compatible con OpenAI (con `LLM_PROVIDER=openai`). |
| `LLM_API_KEY` | – | Clave de ese proveedor. Puede ir vacía solo con un servidor local (Ollama). |
| `LLM_MODEL` | `claude-sonnet-4-5` con Anthropic; obligatorio con `openai` | Id del modelo. |
| `MAX_ITERACIONES` | `25` | Tope de iteraciones herramienta → modelo por turno. |
| `MAX_TOKENS_SESION` | `150000` | Tope de tokens por sesión. |
| `LLM_TIMEOUT_MS` | `60000` | Timeout por llamada al modelo. |
| `FECHA_EJECUCION` | fecha del sistema | `YYYY-MM-DD`. Fija la fecha con la que se evalúan las vigencias. |
| `DIAS_AVISO_VENCIMIENTO` | `30` | Días para el aviso "vence pronto" (no bloquea). |
| `PORT` | `3000` | Puerto HTTP. |

### Sin pagar: proveedores gratuitos

El PRD permite cualquier proveedor. Con `LLM_PROVIDER=openai` el backend habla con cualquier API compatible con OpenAI (`/chat/completions` con herramientas). Ejemplos de configuración en `.env`:

```env
# Google Gemini (clave gratuita en https://aistudio.google.com/apikey, sin tarjeta)
LLM_PROVIDER=openai
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=tu_clave_de_ai_studio
LLM_MODEL=<id de un modelo Gemini Flash vigente, ver la documentación>

# GitHub Models (usa un token de GitHub con permiso "models")
LLM_PROVIDER=openai
LLM_BASE_URL=https://models.github.ai/inference
LLM_API_KEY=tu_token_de_github
LLM_MODEL=openai/gpt-4o-mini

# Ollama local (sin clave; requiere un modelo con soporte de herramientas)
LLM_PROVIDER=openai
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b
```

Los niveles gratuitos tienen límites de uso (el chat mostrará un aviso si se alcanza la cuota) y la calidad de las llamadas a herramientas varía según el modelo. Los ids de modelo cambian con el tiempo: confírmalos en la documentación del proveedor. Antes de la defensa, prueba el flujo completo con el modelo elegido.

## Demo sin modelo

Ejecuta las herramientas sobre los 4 casos de `fixtures/reto-01/casos/` y comprueba invariantes del PRD. No requiere clave.

```bash
npm run demo
# Reproducir el escenario de la fecha del PRD:
#   PowerShell:  $env:FECHA_EJECUCION="2026-09-03"; npm run demo
#   Bash:        FECHA_EJECUCION=2026-09-03 npm run demo
```

Los resultados quedan en `out/<caso>/`. Con la fecha real, los 4 casos salen `listo_para_firma = false` (Cámara de Comercio vencida). Con `2026-09-03`, Delta y Panamá quedan listos; Ecuador y Honduras siguen bloqueados.

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/chat` | `{ sessionId, message }` → `{ reply, toolCalls[], needsConfirmation, esError, uso }` |
| `POST` | `/api/chat/stream` | Mismo cuerpo; responde con **Server-Sent Events**: `estado`, `herramienta_inicio`, `herramienta` (cada llamada a herramienta apenas ocurre), `fin` (respuesta final) o `fallo`. Es la que usa el front. |
| `GET` | `/api/sessions/:id` | Historial de la sesión |
| `GET` | `/api/health` | `{ ok, provider, model, llmConfigurado }` (sin claves) |
| `GET` | `/api/casos` | Casos disponibles (atajos del front) |

El `sessionId` admite letras, números, `_` y `-` (máx. 64). Hay un límite de 30 solicitudes por minuto por IP.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga (`tsx watch`). |
| `npm run build` / `npm start` | Compila a `dist/` y lo ejecuta. |
| `npm run demo` | Verificación sin modelo. |
| `npm run typecheck` | Chequeo de tipos. |

## Despliegue (URL pública) — pendiente

Un único servicio con Docker sirve API y front desde el mismo origen. Con Render:

1. Sube el repositorio a GitHub.
2. En Render: **New → Blueprint**, selecciona el repositorio (usa [render.yaml](./render.yaml)).
3. Carga `ANTHROPIC_API_KEY` en el panel de variables de entorno.
4. Espera el despliegue y abre la URL. Verifica `GET /api/health`.

Antes de la defensa, abre la URL una vez para despertar el servicio (el plan gratuito se duerme tras inactividad).

Prueba local de la imagen:

```bash
docker build -t registro-proveedor-agente .
docker run --rm -p 3000:3000 -e ANTHROPIC_API_KEY=... registro-proveedor-agente
```

Link de prueba: _(pendiente: completar tras el despliegue)_. Clave de acceso: no aplica (el link es público; el gasto está limitado por `MAX_TOKENS_SESION` y el límite por IP).

## Módulo reutilizable (bonus)

La carpeta `modulo/` empaqueta el agente para integrarlo en otras plataformas, **sin copias divergentes**: se genera desde las mismas fuentes que usa la aplicación.

| Pieza del módulo | Fuente única |
|---|---|
| `modulo/agent.md` (frontmatter `description`, `mode: primary`, `permission {edit: deny, bash: deny}` + system prompt) | `agent/prompt.md` |
| `modulo/skill/registro-proveedor/SKILL.md` (frontmatter `name`, `description` + conocimiento) | `src/infrastructure/knowledge/registro-proveedor.md` |
| `modulo/tools/proveedor.ts` (importable sin el servidor) | re-exporta `src/tools/proveedor.ts` |

```bash
npm run modulo          # regenera el módulo desde las fuentes
npm run modulo:check    # falla si el módulo no coincide con las fuentes
```

Las herramientas no dependen de NestJS ni del servidor HTTP; solo de las capas `domain`, `application` e `infrastructure`.

## Estructura

```
agent/prompt.md                      System prompt (XML)
src/domain/                          Capa 1: reglas de negocio puras (RN1, RN3, RN4, vigencias)
src/application/                     Capa 2: casos de uso, puertos y bucle del agente
src/infrastructure/                  Capa 3: archivos, xlsx/pdf, LLM, sesiones, herramientas, conocimiento
src/presentation/                    Capa 4: controllers NestJS (http/) y front de chat (web/: index.html, app.js, styles.css)
src/tools/proveedor.ts               Ruta exigida por el PRD (re-exporta infrastructure/tools/proveedor.ts)
src/app.module.ts, src/main.ts       Raíz de composición y arranque
demo.ts                              Verificación sin modelo
fixtures/                            Entregados por Periferia (solo lectura)
out/                                 Generado en ejecución (no se versiona: está en .gitignore; el servidor y demo.ts lo crean al iniciar)
```
