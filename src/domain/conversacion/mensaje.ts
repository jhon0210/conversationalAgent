export interface BloqueTexto {
  type: "text";
  text: string;
}

export interface BloqueToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  // Datos opacos del proveedor que deben devolverse tal cual (p. ej. firmas de razonamiento).
  extra?: unknown;
}

export interface BloqueToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type Bloque = BloqueTexto | BloqueToolUse | BloqueToolResult;

// Formato interno de mensajes, independiente del proveedor LLM.
export interface Mensaje {
  role: "user" | "assistant";
  content: string | Bloque[];
}
