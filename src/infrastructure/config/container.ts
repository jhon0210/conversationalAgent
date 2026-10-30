import { ArmarPaqueteUseCase } from "../../application/paquete/armar-paquete.usecase";
import { EvaluarSoportesService } from "../../application/paquete/evaluar-soportes.service";
import { GenerarFormularioUseCase } from "../../application/formulario/generar-formulario.usecase";
import { LeerSolicitudUseCase } from "../../application/solicitud/leer-solicitud.usecase";
import { MapearCamposUseCase } from "../../application/mapeo/mapear-campos.usecase";
import { SimularEnvioUseCase } from "../../application/envio/simular-envio.usecase";
import type { AuditLog, ConfirmacionStore } from "../../application/ports/servicios";
import { DocumentosFormularioWriter } from "../documents/formulario-writer";
import { JsonlAuditLog } from "../logging/jsonl-audit-log";
import { FsCasoRepo } from "../persistence/fs-caso-repo";
import { FsMaestroRepo, FsSoporteRepo } from "../persistence/fs-maestro-repo";
import { FsSalidaRepo } from "../persistence/fs-salida-repo";
import { construirRutas } from "../persistence/rutas";
import { MemoriaConfirmacionStore } from "../sessions/memoria-confirmacion-store";
import { leerEntorno } from "./env";
import { SystemClock } from "./system-clock";

export interface Contenedor {
  leerSolicitud: LeerSolicitudUseCase;
  mapearCampos: MapearCamposUseCase;
  generarFormulario: GenerarFormularioUseCase;
  armarPaquete: ArmarPaqueteUseCase;
  simularEnvio: SimularEnvioUseCase;
  confirmaciones: ConfirmacionStore;
  audit: AuditLog;
}

export const construirContenedor = (directory: string): Contenedor => {
  const entorno = leerEntorno();
  const rutas = construirRutas(directory);

  const casos = new FsCasoRepo(rutas);
  const maestro = new FsMaestroRepo(rutas);
  const soportes = new FsSoporteRepo(rutas);
  const salida = new FsSalidaRepo(rutas);
  const confirmaciones = new MemoriaConfirmacionStore();
  const evaluador = new EvaluarSoportesService(soportes, new SystemClock(entorno.fechaEjecucion, entorno.zonaHoraria), {
    diasAvisoVencimiento: entorno.diasAvisoVencimiento,
  });

  const mapearCampos = new MapearCamposUseCase(casos, maestro);
  const generarFormulario = new GenerarFormularioUseCase(casos, mapearCampos, new DocumentosFormularioWriter(rutas));

  return {
    leerSolicitud: new LeerSolicitudUseCase(casos),
    mapearCampos,
    generarFormulario,
    armarPaquete: new ArmarPaqueteUseCase(casos, maestro, generarFormulario, evaluador, salida, confirmaciones),
    simularEnvio: new SimularEnvioUseCase(casos, evaluador, salida, confirmaciones),
    confirmaciones,
    audit: new JsonlAuditLog(rutas),
  };
};

const contenedores = new Map<string, Contenedor>();

// Un contenedor por directorio: conserva el estado de confirmaciones entre llamadas.
export const obtenerContenedor = (directory: string): Contenedor => {
  let c = contenedores.get(directory);
  if (!c) {
    c = construirContenedor(directory);
    contenedores.set(directory, c);
  }
  return c;
};

export const reiniciarContenedores = (): void => contenedores.clear();
