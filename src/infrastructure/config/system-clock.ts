import type { Clock } from "../../application/ports/servicios";

const aIsoLocal = (d: Date): string => {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};

// Fecha de ejecución: FECHA_EJECUCION si existe; si no, la fecha del sistema.
export class SystemClock implements Clock {
  constructor(private readonly fijada?: string) {}

  hoy(): string {
    return this.fijada ?? aIsoLocal(new Date());
  }
}
