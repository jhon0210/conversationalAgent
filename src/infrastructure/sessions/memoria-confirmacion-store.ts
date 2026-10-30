import type { ConfirmacionStore } from "../../application/ports/servicios";
import { confirmacionValida } from "../../domain/envio/confirmacion-pendiente";

interface EstadoSesion {
  turno: number;
  pendientes: Map<string, number>;
}

export class MemoriaConfirmacionStore implements ConfirmacionStore {
  private readonly sesiones = new Map<string, EstadoSesion>();

  private sesion(id: string): EstadoSesion {
    let s = this.sesiones.get(id);
    if (!s) {
      s = { turno: 0, pendientes: new Map() };
      this.sesiones.set(id, s);
    }
    return s;
  }

  armar(sessionId: string, caso: string): void {
    const s = this.sesion(sessionId);
    s.pendientes.set(caso, s.turno);
  }

  avanzarTurno(sessionId: string): void {
    this.sesion(sessionId).turno += 1;
  }

  consumir(sessionId: string, caso: string): boolean {
    const s = this.sesion(sessionId);
    if (!confirmacionValida(s.pendientes.get(caso), s.turno)) return false;
    s.pendientes.delete(caso);
    return true;
  }
}
