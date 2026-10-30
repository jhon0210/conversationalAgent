import {
  LlmError,
  type DefinicionHerramienta,
  type LlmProvider,
  type OpcionesLlm,
  type RespuestaLlm,
} from "../../application/ports/llm";
import type { Bloque, BloqueToolUse, Mensaje } from "../../domain/conversacion/mensaje";

interface LlamadaOpenAI {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
  extra_content?: unknown;
}

interface RespuestaOpenAI {
  choices?: { message?: { content?: string | null; tool_calls?: LlamadaOpenAI[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Algunos proveedores (p. ej. Gemini) rechazan estas claves del JSON Schema.
const limpiarSchema = (nodo: unknown): unknown => {
  if (Array.isArray(nodo)) return nodo.map(limpiarSchema);
  if (nodo && typeof nodo === "object") {
    return Object.fromEntries(
      Object.entries(nodo as Record<string, unknown>)
        .filter(([k]) => k !== "additionalProperties" && k !== "$schema")
        .map(([k, v]) => [k, limpiarSchema(v)]),
    );
  }
  return nodo;
};

const aMensajesOpenAI = (system: string, mensajes: Mensaje[]): unknown[] => {
  const salida: unknown[] = [{ role: "system", content: system }];
  for (const m of mensajes) {
    if (typeof m.content === "string") {
      salida.push({ role: m.role, content: m.content });
    } else if (m.role === "assistant") {
      const texto = m.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      const llamadas = m.content
        .filter((b): b is BloqueToolUse => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          type: "function",
          function: { name: b.name, arguments: JSON.stringify(b.input) },
          ...(b.extra !== undefined ? { extra_content: b.extra } : {}),
        }));
      salida.push({ role: "assistant", content: texto || null, ...(llamadas.length ? { tool_calls: llamadas } : {}) });
    } else {
      for (const b of m.content) {
        if (b.type === "tool_result") salida.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.content });
        else if (b.type === "text") salida.push({ role: "user", content: b.text });
      }
    }
  }
  return salida;
};

/**
 * Adaptador para cualquier API compatible con OpenAI (/chat/completions con tools):
 * Gemini, GitHub Models, Groq, OpenRouter, Ollama, Azure OpenAI, etc.
 */
export class OpenAICompatibleProvider implements LlmProvider {
  readonly nombre = "openai-compatible";
  private contador = 0;

  constructor(
    private readonly baseUrl: string | undefined,
    private readonly apiKey: string | undefined,
    readonly modelo: string,
  ) {}

  get configurado(): boolean {
    if (!this.baseUrl || !this.modelo) return false;
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(this.baseUrl);
    return Boolean(this.apiKey) || local;
  }

  async enviar(
    mensajes: Mensaje[],
    herramientas: DefinicionHerramienta[],
    opciones: OpcionesLlm,
  ): Promise<RespuestaLlm> {
    if (!this.configurado) {
      throw new LlmError(
        "El modelo de lenguaje no está configurado en el servidor (falta URL, clave o modelo).",
        "NO_CONFIGURADO",
      );
    }
    let cuerpo: RespuestaOpenAI;
    try {
      const respuesta = await fetch(`${this.baseUrl!.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.modelo,
          messages: aMensajesOpenAI(opciones.system, mensajes),
          tools: herramientas.map((h) => ({
            type: "function",
            function: { name: h.name, description: h.description, parameters: limpiarSchema(h.inputSchema) },
          })),
        }),
        signal: AbortSignal.timeout(opciones.timeoutMs),
      });
      if (!respuesta.ok) throw this.errorHttp(respuesta.status);
      cuerpo = (await respuesta.json()) as RespuestaOpenAI;
    } catch (error) {
      throw this.traducir(error);
    }

    const mensaje = cuerpo.choices?.[0]?.message;
    const texto = mensaje?.content ?? "";
    const contenido: Bloque[] = [];
    const toolCalls: BloqueToolUse[] = [];
    if (texto) contenido.push({ type: "text", text: texto });
    for (const llamada of mensaje?.tool_calls ?? []) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(llamada.function?.arguments || "{}") as Record<string, unknown>;
      } catch {
        input = {};
      }
      const uso: BloqueToolUse = {
        type: "tool_use",
        id: llamada.id || `call_${++this.contador}`,
        name: llamada.function?.name ?? "",
        input,
        ...(llamada.extra_content !== undefined ? { extra: llamada.extra_content } : {}),
      };
      contenido.push(uso);
      toolCalls.push(uso);
    }
    return {
      texto,
      toolCalls,
      contenido,
      usage: { input: cuerpo.usage?.prompt_tokens ?? 0, output: cuerpo.usage?.completion_tokens ?? 0 },
    };
  }

  private errorHttp(estado: number): LlmError {
    if (estado === 401 || estado === 403) {
      return new LlmError("El servidor no pudo autenticarse con el proveedor del modelo. Avisa al administrador.", "AUTENTICACION");
    }
    if (estado === 429) {
      return new LlmError("El proveedor del modelo está limitando las solicitudes (cuota gratuita). Espera un momento e intenta de nuevo.", "LIMITE");
    }
    return new LlmError("El proveedor del modelo devolvió un error. Intenta de nuevo en unos segundos.", "PROVEEDOR");
  }

  private traducir(error: unknown): LlmError {
    if (error instanceof LlmError) return error;
    const nombre = (error as { name?: string } | null)?.name ?? "";
    if (/timeout|abort/i.test(nombre)) {
      return new LlmError("El modelo tardó demasiado en responder. Intenta de nuevo.", "TIMEOUT");
    }
    return new LlmError("No pude comunicarme con el modelo de lenguaje. Intenta de nuevo en unos segundos.", "PROVEEDOR");
  }
}
