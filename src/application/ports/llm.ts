import type { Bloque, BloqueToolUse, Mensaje } from "../../domain/conversacion/mensaje";

export interface DefinicionHerramienta {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface RespuestaLlm {
  texto: string;
  toolCalls: BloqueToolUse[];
  contenido: Bloque[];
  usage: { input: number; output: number };
}

export interface OpcionesLlm {
  system: string;
  timeoutMs: number;
}

// Error del proveedor con mensaje apto para mostrar al usuario (sin claves ni trazas).
export class LlmError extends Error {
  constructor(
    message: string,
    readonly codigo: "TIMEOUT" | "AUTENTICACION" | "LIMITE" | "NO_CONFIGURADO" | "PROVEEDOR",
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export interface LlmProvider {
  readonly nombre: string;
  readonly modelo: string;
  readonly configurado: boolean;
  enviar(mensajes: Mensaje[], herramientas: DefinicionHerramienta[], opciones: OpcionesLlm): Promise<RespuestaLlm>;
}
