import { promises as fs } from "node:fs";
import path from "node:path";
import type { AuditLog, EntradaAuditoria } from "../../application/ports/servicios";
import { resolverDentro, type Rutas } from "../persistence/rutas";

// CA4 y RN5: out/log.jsonl (global) y out/<caso>/log.jsonl (por caso).
export class JsonlAuditLog implements AuditLog {
  constructor(private readonly rutas: Rutas) {}

  async registrar(entrada: EntradaAuditoria): Promise<void> {
    try {
      const linea = `${JSON.stringify({ ts: new Date().toISOString(), herramienta: entrada.herramienta, ok: entrada.ok, resumen: entrada.resumen })}\n`;
      await this.agregar(path.join(this.rutas.salida, "log.jsonl"), linea);
      if (entrada.caso) {
        const carpeta = resolverDentro(this.rutas.salida, entrada.caso);
        await this.agregar(path.join(carpeta, "log.jsonl"), linea);
      }
    } catch {
      // El log nunca debe romper una herramienta.
    }
  }

  private async agregar(ruta: string, linea: string): Promise<void> {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    await fs.appendFile(ruta, linea, "utf8");
  }
}
