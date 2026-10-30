import type { Clock } from "../../application/ports/servicios";

export const ZONA_HORARIA_POR_DEFECTO = "America/Bogota";

// Fecha de ejecución: FECHA_EJECUCION si existe; si no, el día actual en la zona horaria configurada
// (así un servidor en UTC no adelanta la fecha respecto a la analista).
export class SystemClock implements Clock {
  private readonly formato: Intl.DateTimeFormat;

  constructor(
    private readonly fijada?: string,
    zonaHoraria: string = ZONA_HORARIA_POR_DEFECTO,
  ) {
    this.formato = SystemClock.crearFormato(zonaHoraria);
  }

  hoy(): string {
    return this.fijada ?? this.formato.format(new Date());
  }

  private static crearFormato(zona: string): Intl.DateTimeFormat {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONA_HORARIA_POR_DEFECTO,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
  }
}
