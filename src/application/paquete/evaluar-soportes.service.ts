import { evaluarSoporte } from "../../domain/soporte/evaluador-vigencia";
import type { SoporteEvaluado } from "../../domain/soporte/soporte";
import type { SoporteRepo } from "../ports/repositorios";
import type { Clock, ReglasNegocio } from "../ports/servicios";

export class EvaluarSoportesService {
  constructor(
    private readonly soportes: SoporteRepo,
    private readonly clock: Clock,
    private readonly reglas: ReglasNegocio,
  ) {}

  async evaluar(exigidos: string[]): Promise<{ fechaEjecucion: string; soportes: SoporteEvaluado[] }> {
    const fechaEjecucion = this.clock.hoy();
    const soportes: SoporteEvaluado[] = [];
    for (const tipo of exigidos) {
      const registro = await this.soportes.buscar(tipo);
      soportes.push(evaluarSoporte(tipo, registro, fechaEjecucion, this.reglas.diasAvisoVencimiento));
    }
    return { fechaEjecucion, soportes };
  }
}
