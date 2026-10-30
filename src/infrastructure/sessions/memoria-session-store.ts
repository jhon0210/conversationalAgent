import type { SessionStore } from "../../application/ports/agente";
import { nuevaSesion, type Sesion } from "../../domain/conversacion/sesion";

const MAX_SESIONES = 200;

export class MemoriaSessionStore implements SessionStore {
  private readonly sesiones = new Map<string, Sesion>();

  existe(id: string): boolean {
    return this.sesiones.has(id);
  }

  obtener(id: string): Sesion {
    let sesion = this.sesiones.get(id);
    if (!sesion) {
      if (this.sesiones.size >= MAX_SESIONES) {
        const masAntigua = this.sesiones.keys().next().value;
        if (masAntigua !== undefined) this.sesiones.delete(masAntigua);
      }
      sesion = nuevaSesion(id);
      this.sesiones.set(id, sesion);
    }
    return sesion;
  }
}
