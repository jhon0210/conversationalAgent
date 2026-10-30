import type { Sesion } from "../../domain/conversacion/sesion";
import type { DefinicionHerramienta } from "./llm";

export interface SessionStore {
  obtener(id: string): Sesion;
  existe(id: string): boolean;
}

export interface RegistroHerramientas {
  definiciones(): DefinicionHerramienta[];
  ejecutar(nombre: string, args: unknown, ctx: { directory: string; sessionId: string }): Promise<string>;
}

export interface PromptProvider {
  cargar(): Promise<string>;
}
