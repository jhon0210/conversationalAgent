import { listoParaFirma, bloqueosDeFirma } from "../../domain/soporte/regla-listo-para-firma";
import type { SoporteEvaluado } from "../../domain/soporte/soporte";
import { valorPorRuta } from "../../domain/mapeo/ruta-maestro";
import type { GenerarFormularioUseCase } from "../formulario/generar-formulario.usecase";
import type { CasoRepo, MaestroRepo } from "../ports/repositorios";
import type { SalidaRepo } from "../ports/salida";
import type { ConfirmacionStore } from "../ports/servicios";
import { borradorCorreoMd, checklistMd } from "./documentos-texto";
import type { EvaluarSoportesService } from "./evaluar-soportes.service";

export interface ResultadoPaquete {
  ruta: string;
  fecha_ejecucion: string;
  listo_para_firma: boolean;
  checklist: {
    soportes: {
      tipo: string;
      estado: string;
      vigencia_hasta: string | null;
      aviso?: string;
      nota?: string;
    }[];
    bloqueos: string[];
    avisos: string[];
    campos_faltantes: string[];
    campos_requieren_confirmacion: string[];
  };
  archivos: string[];
}

const nombreArchivo = (ruta: string): string => ruta.split("/").pop() ?? ruta;

export class ArmarPaqueteUseCase {
  constructor(
    private readonly casos: CasoRepo,
    private readonly maestro: MaestroRepo,
    private readonly generar: GenerarFormularioUseCase,
    private readonly evaluador: EvaluarSoportesService,
    private readonly salida: SalidaRepo,
    private readonly confirmaciones: ConfirmacionStore,
  ) {}

  async ejecutar(entrada: { caso: string }, sessionId: string): Promise<ResultadoPaquete> {
    const { caso } = entrada;
    const { solicitud, soportesExigidos } = await this.casos.cargar(caso);
    const formulario = await this.generar.ejecutar({ caso });
    const { fechaEjecucion, soportes } = await this.evaluador.evaluar(soportesExigidos);
    const listo = listoParaFirma(soportes);

    const base = `${caso}/paquete`;
    const archivos: string[] = [];
    const nombreFormulario = nombreArchivo(formulario.ruta);
    await this.salida.copiarEnSalida(`${caso}/${nombreFormulario}`, `${base}/${nombreFormulario}`);
    archivos.push(`out/${base}/${nombreFormulario}`);

    const adjuntosCorreo = [nombreFormulario];
    for (const s of soportes) {
      if (!s.archivo) continue;
      await this.salida.copiarDesdeSoportes(s.archivo, `${base}/soportes/${s.archivo}`);
      archivos.push(`out/${base}/soportes/${s.archivo}`);
      if (s.estado === "presente") adjuntosCorreo.push(s.archivo);
    }

    await this.salida.escribirTexto(
      `${base}/checklist.md`,
      checklistMd({
        caso,
        solicitud,
        fechaEjecucion,
        listo,
        soportes,
        camposFaltantes: formulario.campos_faltantes,
        camposConfirmacion: formulario.campos_requieren_confirmacion,
        archivoFormulario: nombreFormulario,
      }),
    );
    archivos.push(`out/${base}/checklist.md`);

    const maestro = await this.maestro.obtener();
    const razonSocial = String(valorPorRuta(maestro, "razon_social") ?? "Periferia IT Group");
    await this.salida.escribirTexto(`${base}/borrador-correo.md`, borradorCorreoMd(solicitud, razonSocial, adjuntosCorreo));
    archivos.push(`out/${base}/borrador-correo.md`);

    this.confirmaciones.armar(sessionId, caso);

    return {
      ruta: `out/${base}/`,
      fecha_ejecucion: fechaEjecucion,
      listo_para_firma: listo,
      checklist: {
        soportes: soportes.map(this.presentar),
        bloqueos: bloqueosDeFirma(soportes),
        avisos: soportes
          .filter((s) => s.aviso === "vence_pronto")
          .map((s) => `${s.tipo} vence pronto (${s.vigenciaHasta}, en ${s.venceProntoEnDias} día(s))`),
        campos_faltantes: formulario.campos_faltantes,
        campos_requieren_confirmacion: formulario.campos_requieren_confirmacion,
      },
      archivos,
    };
  }

  private presentar(s: SoporteEvaluado): ResultadoPaquete["checklist"]["soportes"][number] {
    return { tipo: s.tipo, estado: s.estado, vigencia_hasta: s.vigenciaHasta, aviso: s.aviso, nota: s.nota };
  }
}
