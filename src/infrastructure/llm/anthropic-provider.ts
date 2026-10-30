import Anthropic from "@anthropic-ai/sdk";
import {
  LlmError,
  type DefinicionHerramienta,
  type LlmProvider,
  type OpcionesLlm,
  type RespuestaLlm,
} from "../../application/ports/llm";
import type { Bloque, BloqueToolUse, Mensaje } from "../../domain/conversacion/mensaje";

export const MODELO_POR_DEFECTO = "claude-sonnet-4-5";

const MAX_TOKENS_SALIDA = 2048;

export class AnthropicProvider implements LlmProvider {
  readonly nombre = "anthropic";
  private readonly cliente?: Anthropic;

  constructor(
    apiKey: string | undefined,
    readonly modelo: string = MODELO_POR_DEFECTO,
  ) {
    if (apiKey) this.cliente = new Anthropic({ apiKey, maxRetries: 1 });
  }

  get configurado(): boolean {
    return this.cliente !== undefined;
  }

  async enviar(
    mensajes: Mensaje[],
    herramientas: DefinicionHerramienta[],
    opciones: OpcionesLlm,
  ): Promise<RespuestaLlm> {
    if (!this.cliente) {
      throw new LlmError("El modelo de lenguaje no está configurado en el servidor (falta la clave del proveedor).", "NO_CONFIGURADO");
    }
    try {
      const respuesta = await this.cliente.messages.create(
        {
          model: this.modelo,
          max_tokens: MAX_TOKENS_SALIDA,
          // El prompt es estable entre llamadas: se marca para caché de prompt.
          system: [{ type: "text", text: opciones.system, cache_control: { type: "ephemeral" } }],
          messages: mensajes.map(this.aAnthropic),
          tools: herramientas.map((h) => ({
            name: h.name,
            description: h.description,
            input_schema: h.inputSchema as Anthropic.Tool.InputSchema,
          })),
        },
        { timeout: opciones.timeoutMs },
      );

      const contenido: Bloque[] = [];
      const toolCalls: BloqueToolUse[] = [];
      let texto = "";
      for (const bloque of respuesta.content) {
        if (bloque.type === "text") {
          contenido.push({ type: "text", text: bloque.text });
          texto += bloque.text;
        } else if (bloque.type === "tool_use") {
          const uso: BloqueToolUse = {
            type: "tool_use",
            id: bloque.id,
            name: bloque.name,
            input: (bloque.input ?? {}) as Record<string, unknown>,
          };
          contenido.push(uso);
          toolCalls.push(uso);
        }
      }
      return {
        texto,
        toolCalls,
        contenido,
        usage: { input: respuesta.usage.input_tokens, output: respuesta.usage.output_tokens },
      };
    } catch (error) {
      throw this.traducir(error);
    }
  }

  private aAnthropic(m: Mensaje): Anthropic.MessageParam {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    const bloques = m.content.map((b): Anthropic.ContentBlockParam => {
      if (b.type === "tool_use") return { type: "tool_use", id: b.id, name: b.name, input: b.input };
      return b;
    });
    return { role: m.role, content: bloques };
  }

  private traducir(error: unknown): LlmError {
    const estado = (error as { status?: number } | null)?.status;
    const nombre = (error as { name?: string } | null)?.name ?? "";
    if (/timeout/i.test(nombre) || /abort/i.test(nombre)) {
      return new LlmError("El modelo tardó demasiado en responder. Intenta de nuevo.", "TIMEOUT");
    }
    if (estado === 401 || estado === 403) {
      return new LlmError("El servidor no pudo autenticarse con el proveedor del modelo. Avisa al administrador.", "AUTENTICACION");
    }
    if (estado === 429) {
      return new LlmError("El proveedor del modelo está limitando las solicitudes. Espera un momento e intenta de nuevo.", "LIMITE");
    }
    return new LlmError("No pude comunicarme con el modelo de lenguaje. Intenta de nuevo en unos segundos.", "PROVEEDOR");
  }
}
