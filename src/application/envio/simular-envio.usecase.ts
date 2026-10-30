import { AppError } from "../../domain/shared/errores";
import { listoParaFirma } from "../../domain/soporte/regla-listo-para-firma";
import type { EvaluarSoportesService } from "../paquete/evaluar-soportes.service";
import { envioSimuladoMd } from "../paquete/documentos-texto";
import type { CasoRepo } from "../ports/repositorios";
import type { SalidaRepo } from "../ports/salida";
import type { ConfirmacionStore } from "../ports/servicios";

export const ERROR_CONFIRMACION = "requiere confirmación explícita";

export class SimularEnvioUseCase {
  constructor(
    private readonly casos: CasoRepo,
    private readonly evaluador: EvaluarSoportesService,
    private readonly salida: SalidaRepo,
    private readonly confirmaciones: ConfirmacionStore,
  ) {}

  async ejecutar(
    entrada: { caso: string; confirmado: boolean },
    sessionId: string,
  ): Promise<{ ruta: string; listo_para_firma: boolean; simulado: true }> {
    if (!entrada.confirmado) throw new AppError(ERROR_CONFIRMACION, "CONFIRMACION");

    const { solicitud, soportesExigidos } = await this.casos.cargar(entrada.caso);
    if (!(await this.salida.existe(`${entrada.caso}/paquete/checklist.md`))) {
      throw new AppError(`${ERROR_CONFIRMACION}: primero debe armarse el paquete del caso`, "CONFIRMACION");
    }
    if (!this.confirmaciones.consumir(sessionId, entrada.caso)) {
      throw new AppError(
        `${ERROR_CONFIRMACION}: el usuario debe confirmar en un mensaje posterior a la solicitud`,
        "CONFIRMACION",
      );
    }

    const { fechaEjecucion, soportes } = await this.evaluador.evaluar(soportesExigidos);
    const listo = listoParaFirma(soportes);
    const destino = `${entrada.caso}/ENVIO-SIMULADO.md`;
    await this.salida.escribirTexto(
      destino,
      envioSimuladoMd({
        caso: entrada.caso,
        cliente: solicitud.cliente,
        fechaEjecucion,
        listo,
        ts: new Date().toISOString(),
      }),
    );
    return { ruta: `out/${destino}`, listo_para_firma: listo, simulado: true };
  }
}
