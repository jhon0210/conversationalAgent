import type { Mensaje } from "./mensaje";

export interface LlamadaHerramientaVista {
  id: string;
  nombre: string;
  args: Record<string, unknown>;
  ok: boolean;
  resumen: string;
  resultado: string;
  duracionMs: number;
}

export interface EntradaHistorial {
  rol: "user" | "assistant" | "error";
  texto: string;
  toolCalls: LlamadaHerramientaVista[];
  needsConfirmation: boolean;
  ts: string;
}

export interface Sesion {
  id: string;
  mensajes: Mensaje[];
  historial: EntradaHistorial[];
  tokensUsados: number;
  ocupada: boolean;
}

export const nuevaSesion = (id: string): Sesion => ({
  id,
  mensajes: [],
  historial: [],
  tokensUsados: 0,
  ocupada: false,
});
