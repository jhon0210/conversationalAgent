# SOLUCION.md — Agente "Registro como Proveedor"

## 1. Problema en una frase

La analista administrativa de Periferia transcribe a mano, campo por campo, los mismos datos en 8–12 formularios al mes (Excel, PDF o portal), con riesgo de error en datos sensibles y dependencia del conocimiento de una sola persona. El agente prepara ese trabajo y deja a un humano la firma y el envío.

## 2. Arquitectura

```
┌────────────────┐  HTTP   ┌────────────────────────────────────────────────────┐
│ Front de chat  │ ──────▶ │ presentation  (NestJS: controllers, filtro, límite) │
│ historial      │ ◀────── └───────────────┬────────────────────────────────────┘
│ tool calls     │                         │
│ confirmación   │            ┌────────────▼─────────────┐
└────────────────┘            │ application              │
                              │  EjecutarTurno (bucle)   │──▶ LlmProvider (puerto)
                              │  casos de uso + puertos  │
                              └────────────┬─────────────┘
                                           │ usa
                              ┌────────────▼─────────────┐        ┌─────────────────┐
                              │ domain (reglas puras)    │        │ infrastructure  │
                              │ RN1, RN3, RN4, vigencias │◀───────│ Anthropic, fs,  │
                              └──────────────────────────┘        │ exceljs/pdfkit, │
                                                                  │ herramientas    │
        fixtures/ (solo lectura)  ◀──────────────────────────────▶│ log JSONL       │
        out/ (escritura)                                          └─────────────────┘
```

**Capas → módulos → componentes.** La organización principal es por capas; dentro de cada una hay módulos funcionales (solicitud, mapeo, soporte, formulario, paquete, envío, agente).

| Capa | Contenido | Depende de |
|---|---|---|
| `src/domain/` | Entidades y reglas puras: clasificación de campos, regla del identificador por país (RN1), evaluación de vigencias, regla `listo_para_firma` (RN3), validez de la confirmación (RN4). | Nada |
| `src/application/` | Casos de uso (`LeerSolicitud`, `MapearCampos`, `GenerarFormulario`, `ArmarPaquete`, `SimularEnvio`, `EjecutarTurno`) y puertos. | `domain` |
| `src/infrastructure/` | Repositorios de archivos, escritores xlsx/pdf/md, adaptador Anthropic, log JSONL, sesiones, herramientas Zod, prompt y conocimiento. | `application`, `domain` |
| `src/presentation/` | Controllers NestJS, filtro de errores, límite por IP y front. | `application` |

**Dónde vive cada cosa** (separación que evalúa el PRD):

- **Comportamiento:** `agent/prompt.md`.
- **Conocimiento:** `src/infrastructure/knowledge/registro-proveedor.md` (se añade al prompt en `<knowledge>`).
- **Ejecución:** `src/infrastructure/tools/proveedor.ts` (y los casos de uso que invoca).

`src/tools/proveedor.ts` solo re-exporta las herramientas: es la ruta que exige el PRD, sin romper la dirección de dependencias.

## 3. Ciclo del agente

Implementado en `EjecutarTurnoUseCase`:

1. Valida el mensaje (no vacío, máx. 4000 caracteres) y marca la sesión como ocupada (una solicitud a la vez por sesión).
2. Incrementa el turno de la sesión en el `ConfirmacionStore`.
3. Carga `agent/prompt.md` + conocimiento y las definiciones de herramientas (JSON Schema generado desde Zod).
4. **Bucle** (máx. `MAX_ITERACIONES`, por defecto 25): llama al modelo → si pide herramientas, las ejecuta, agrega los `tool_result` y repite → si responde solo texto, termina el turno.
5. Cada llamada queda visible en el chat (nombre, argumentos, resultado) y en `out/log.jsonl` y `out/<caso>/log.jsonl`. El front las recibe **en vivo** por Server-Sent Events (`POST /api/chat/stream`): el caso de uso emite eventos de progreso (`estado`, `herramienta_inicio`, `herramienta`) y el controlador los reenvía al navegador, que anima el avance (stepper, tarjetas y resumen del paquete) mientras el modelo trabaja. El evento `fin` trae la respuesta final. `POST /api/chat` sigue disponible sin streaming.
6. Al llegar al tope de iteraciones o de tokens, responde con lo ejecutado y lo que falta.
7. Un error del proveedor (timeout, 401, 429…) se traduce a un mensaje claro; la sesión sigue viva.

**Confirmación humana (RN4 / CA3).** Se refuerza en el servidor y no solo en el prompt:

- `proveedor_armar_paquete` registra una confirmación pendiente con el turno actual.
- `proveedor_simular_envio(confirmado: true)` solo procede si existe una pendiente **de un turno anterior**, y la consume. El modelo no puede confirmarse a sí mismo dentro del mismo turno, ni reutilizar una confirmación.
- El prompt obliga a cerrar con `CONFIRMACIÓN REQUERIDA: …`; el front resalta ese estado con un panel ámbar y botones Sí/No. `needsConfirmation` es verdadero si aparece ese marcador o si se armó un paquete sin simular el envío.

**CA2 por diseño.** `proveedor_generar_formulario` recibe el mapeo pero **recalcula todos los valores desde el maestro**; lo que envíe el modelo solo se contrasta (`discrepancias_mapeo`). Las herramientas son la única fuente de valores. El número de cuenta se enmascara en lo que ve el modelo.

## 4. Elección del modelo

- **Proveedor:** el adaptador `LlmProvider` tiene dos implementaciones reales: Anthropic (por defecto, modelo configurable con `LLM_MODEL`, `claude-sonnet-4-5` si se omite) y un adaptador compatible con OpenAI (`LLM_PROVIDER=openai`) que permite usar Gemini, GitHub Models, Groq, Ollama u otros, incluidas opciones gratuitas. El adaptador compatible con OpenAI se verificó contra un servidor simulado; no se ha probado con una clave real.
- **Por qué:** el trabajo exige seguir reglas estrictas y encadenar herramientas de forma fiable; la clase Sonnet ofrece buen equilibrio entre calidad y costo. El adaptador es una interfaz propia (`LlmProvider`), así que cambiar de proveedor no toca el bucle.
- **Control de gasto:** `MAX_ITERACIONES`, `MAX_TOKENS_SESION`, `LLM_TIMEOUT_MS`, límite de 30 solicitudes/min por IP y caché de prompt (`cache_control` en el system prompt).

### Costo estimado por caso procesado

Base de precios usada (clase Claude 3.5 Sonnet, USD por millón de tokens): entrada 3,00 · salida 15,00 · escritura de caché 3,75 · lectura de caché 0,30. **Verifica la tarifa vigente del modelo que uses.**

Tamaños medidos sobre los fixtures (caracteres ÷ ~3,5 por token):

| Elemento | Tamaño aproximado |
|---|---|
| System prompt + conocimiento | ~2,9k tokens |
| Definiciones de las 5 herramientas | ~0,9k tokens |
| Resultados de herramientas por caso | 0,5k–1,4k tokens |

Un caso completo son ~5 llamadas al modelo para procesar y ~2 para la confirmación. El historial crece en cada llamada.

| | Sin caché | Con caché de prompt |
|---|---|---|
| Entrada por caso | ~38k tokens → ~$0,11 | ~11k tokens normales + 3,8k escritos + 23k leídos → ~$0,05 |
| Salida por caso | ~1,6k tokens → ~$0,02 | ~$0,02 |
| **Total por caso** | **≈ $0,14** | **≈ $0,08** |

- **Mes típico (8–12 casos):** entre $1 y $2, o menos de $4 contando reintentos y conversación extra.
- **Tope por sesión:** `MAX_TOKENS_SESION` = 150k tokens ⇒ en el peor caso ≈ $0,45–0,50.

Son estimaciones; el uso real de cada sesión se muestra en el chat ("Tokens de la sesión") y debe contrastarse con la facturación del proveedor. Con un proveedor de nivel gratuito (Gemini, GitHub Models) el costo monetario es $0, sujeto a cuotas de uso.

## 5. Diseño del portal web (§7.4, solo documentación)

El formato `portal` **no se implementa**: el agente responde "formato no soportado" y genera `out/<caso>/valores-portal.md` con los valores listos para copiar (incluye campos pendientes y notas).

**Estrategia propuesta para producción**

| Opción | Cuándo | Límites |
|---|---|---|
| Extensión de navegador asistida (recomendada) | El humano abre el portal; la extensión rellena campos a partir de `valores-portal` y el humano revisa. | Depende del layout del portal; mantenimiento por portal. |
| Navegador controlado por el agente (Playwright, MCP de navegador) | Portales estables y sin controles anti-bot. | CAPTCHA, MFA, cambios de layout, sesiones expiradas. |
| RPA clásico | Procesos repetidos con el mismo portal. | Frágil ante cambios; costo de licencias. |

**Credenciales:** nunca en el repositorio, el prompt ni los logs. Las ingresa la persona directamente en el portal (o en un gestor de secretos con acceso controlado) y el agente no las ve. Si una solicitud menciona credenciales, el agente no las pide ni las repite.

**Reparto de responsabilidades**

| Agente | Humano |
|---|---|
| Leer la solicitud, mapear campos, generar `valores-portal.md`, listar faltantes y soportes. | **Ingresar usuario/contraseña, resolver CAPTCHA/MFA, revisar y hacer clic en "Enviar".** |

## 6. Decisiones y trade-offs

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| 1 | **Mapeo determinista** con glosario y similitud de bigramas (≥ 0,8 → lleno; 0,6–0,8 → confirmar; < 0,6 → faltante). | Pedir al LLM que mapee. | Trazabilidad por ruta del maestro, cero alucinaciones y resultado reproducible. El LLM orquesta y explica. |
| 2 | **Valores recalculados en el servidor** (el `mapeo` del modelo solo se contrasta). | Confiar en el mapeo que devuelve el modelo. | Hace imposible que el modelo altere un dato aunque lo intente (CA2). |
| 3 | **Confirmación validada en el servidor** por turno. | Confiar solo en el prompt. | Un modelo puede equivocarse o ser manipulado; RN4 debe cumplirse siempre. |
| 4 | **Sin RAG.** El conocimiento es pequeño y se carga en el prompt. | Búsqueda por embeddings. | Más costo y más riesgo de "fragmentos parecidos"; el PRD pide determinismo y herramientas como única fuente. |
| 5 | **NestJS 11 en CommonJS** con inyección por tokens explícitos. | NestJS 12 (solo ESM) o Express plano. | Compatibilidad con el resto del stack y la ejecución con `tsx`; Nest da una raíz de composición clara. |
| 6 | **Re-export en `src/tools/proveedor.ts`.** | Poner las herramientas fuera de las capas. | Cumple la ruta del PRD sin violar "capas primero". |
| 7 | **Sesiones y confirmaciones en memoria.** | Base de datos. | No-objetivo del PRD; basta para la defensa. Se reinician al redeploy. |

## 7. Supuestos

- **Fecha de ejecución = fecha real del sistema** (`FECHA_EJECUCION` solo la sobrescribe para pruebas). Un soporte está vencido si `vigencia_hasta` < fecha de ejecución; el mismo día sigue vigente. La fecha de la solicitud (`solicitud.fecha`) es solo informativa.
- Con la fecha real los 4 casos de ejemplo quedan bloqueados por la Cámara de Comercio vencida; con `FECHA_EJECUCION=2026-09-03` se reproduce el escenario del PRD (Delta y Panamá listos; Ecuador y Honduras bloqueados).
- Solo bloquean los soportes **exigidos por el caso**; un campo `faltante` no bloquea pero se lista.
- El glosario es la única fuente de sinónimos. Una etiqueta sin equivalente (p. ej. "Referencias comerciales") es `faltante`.
- "Correo electrónico" mapea a `contacto_comercial.email` según el glosario; la ruta queda visible en el resultado.
- Los datos bancarios solo se llenan si la plantilla los pide, y nunca aparecen en el borrador de correo ni en el checklist.
- `País` se llena con el valor literal del maestro (`CO`); no se traduce a nombre ni se convierte moneda.
- El maestro está actualizado (en producción necesita un dueño del dato).
- El modelo por defecto `claude-sonnet-4-5` es un supuesto de configuración que debe validarse con la clave real.

## 8. Cobertura

| Historia | Estado | Notas / qué falta para producción |
|---|---|---|
| HU-1 Leer la solicitud | Hecho | Etiqueta tributaria genérica → `requiere_confirmacion` con equivalente del país. Falta soportar adjuntos reales (hoy el correo viene normalizado). |
| HU-2 Mapear campos | Hecho | Tres estados, ruta del maestro, sinónimos del glosario. Falta curar el glosario con más clientes. |
| HU-3 Generar formulario | Hecho (P0 xlsx, P1 pdf; P2 portal como `valores-portal.md`) | El PDF es generado (no AcroForm rellenado), aceptado por el PRD. |
| HU-4 Paquete para firma | Hecho | Formulario, soportes, `checklist.md`, `borrador-correo.md`, aviso "vence pronto" (extra). Falta integrar firma electrónica y envío real. |
| HU-5 Manejo de errores | Hecho | Herramientas devuelven `{ok,…}` y nunca lanzan; errores sin traza; un caso malo no frena el siguiente. |
| `proveedor_simular_envio` (P1) | Hecho | Exige confirmación en un turno posterior. |
| Bonus `modulo/` | Hecho | `agent.md`, `SKILL.md` y `tools/proveedor.ts` se generan desde las fuentes de la aplicación (`npm run modulo`; `npm run modulo:check` verifica que no divergen). |
| Enlace público | Preparado, **despliegue pendiente** | `Dockerfile` y `render.yaml` listos; falta desplegar en Render con la clave del modelo y probar la imagen. |

## 9. Uso de IA

Declaración para completar/ajustar por quien presenta la solución:

- **GitHub Copilot (agente en VS Code):** análisis del PRD y los fixtures, diseño del system prompt, arquitectura por capas, generación del código (dominio, casos de uso, herramientas, NestJS, front, streaming, módulo reutilizable), pruebas con `demo.ts` y redacción de esta documentación.
- **Revisado manualmente / ajustado:** reglas de negocio (RN1–RN5), decisión de la fecha de ejecución, nombres de herramientas y estructura de carpetas.
- **Propuestas descartadas:** RAG (innecesario para un conocimiento pequeño y estructurado); mapeo por LLM (se prefirió determinista); NestJS 12 (solo ESM, incompatible con el resto); `zod-to-json-schema` (Zod 4 ya genera JSON Schema); Bun (se pidió Node + NestJS).

## 10. Riesgos de producción y mitigación

| Riesgo | Mitigación |
|---|---|
| El modelo "completa" un campo faltante con un valor plausible. | Valores solo desde herramientas, recalculados en el servidor; el prompt prohíbe valores fuera del mapeo; `demo.ts` verifica invariantes. |
| Soportes vencidos o ausentes pasan inadvertidos. | Regla RN3 en el dominio, con fecha del sistema y checklist por caso. |
| Datos bancarios filtrados. | Solo se llenan si se piden; enmascarado para el modelo; excluidos del correo y del checklist. |
| Inyección de instrucciones en correos o documentos. | El prompt trata su contenido como datos; las herramientas no ejecutan comandos ni abren URLs. |
| Gasto descontrolado en un enlace público. | Topes de iteraciones y tokens, límite por IP y timeout; añadir autenticación o cuota por usuario. |
| Estado en memoria (se pierde al reiniciar; no escala horizontalmente). | Persistir sesiones y confirmaciones en una base de datos o caché compartida. |
| Plantillas reales más variadas que los fixtures. | Ampliar glosario, añadir pruebas por cliente y un flujo de revisión humana de mapeos dudosos. |
| Portales con CAPTCHA/MFA. | El humano opera el portal; el agente solo prepara los valores. |
| Dependencia de un proveedor LLM. | Adaptador `LlmProvider` desacoplado; evaluación periódica con los casos de prueba al cambiar de modelo. |
| Dato maestro desactualizado. | Asignar dueño del dato y fecha de última revisión en el maestro. |
