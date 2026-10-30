import { bloqueosDeFirma } from "../../domain/soporte/regla-listo-para-firma";
import type { SoporteEvaluado } from "../../domain/soporte/soporte";
import type { Solicitud } from "../../domain/solicitud/solicitud";

export interface DatosChecklist {
  caso: string;
  solicitud: Solicitud;
  fechaEjecucion: string;
  listo: boolean;
  soportes: SoporteEvaluado[];
  camposFaltantes: string[];
  camposConfirmacion: string[];
  archivoFormulario: string;
}

const etiquetaEstado = (s: SoporteEvaluado): string => {
  if (s.estado === "presente") return s.aviso === "vence_pronto" ? "presente (vence pronto)" : "presente";
  return s.estado;
};

const lista = (items: string[]): string => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- Ninguno");

export const checklistMd = (d: DatosChecklist): string => {
  const filas = d.soportes
    .map((s) => `| ${s.tipo} | ${etiquetaEstado(s)} | ${s.vigenciaHasta ?? "no aplica"} | ${s.nota ?? ""} |`)
    .join("\n");
  const avisos = d.soportes
    .filter((s) => s.aviso === "vence_pronto")
    .map((s) => `${s.tipo} vence pronto (vigencia_hasta ${s.vigenciaHasta}, en ${s.venceProntoEnDias} día(s))`);
  const bloqueos = bloqueosDeFirma(d.soportes);

  return [
    `# Checklist de paquete - ${d.caso}`,
    "",
    `- Cliente: ${d.solicitud.cliente} (${d.solicitud.pais})`,
    `- Formato: ${d.solicitud.formato}`,
    `- Fecha de ejecución: ${d.fechaEjecucion}`,
    `- Estado: **${d.listo ? "LISTO PARA FIRMA" : "NO LISTO PARA FIRMA"}**`,
    "",
    "## Bloqueos",
    lista(bloqueos),
    "",
    "## Soportes exigidos",
    "| Soporte | Estado | Vigencia hasta | Nota |",
    "|---|---|---|---|",
    filas,
    "",
    "## Avisos (no bloquean)",
    lista(avisos),
    "",
    "## Campos faltantes (no bloquean)",
    lista(d.camposFaltantes),
    "",
    "## Campos que requieren confirmación",
    lista(d.camposConfirmacion),
    "",
    `Formulario: ${d.archivoFormulario}`,
    "",
  ].join("\n");
};

// RN2: el correo nunca recibe datos bancarios; solo usa datos de la solicitud.
export const borradorCorreoMd = (
  solicitud: Solicitud,
  razonSocial: string,
  adjuntos: string[],
): string =>
  [
    "<!-- BORRADOR: revisar checklist.md y obtener la firma del representante legal antes de enviar -->",
    `**Para:** ${solicitud.de}`,
    `**Asunto:** Re: ${solicitud.asunto}`,
    "",
    "Estimados señores de " + solicitud.cliente + ",",
    "",
    `Adjuntamos el formulario diligenciado y los soportes solicitados para el registro de ${razonSocial} como proveedor.`,
    "",
    "Documentos adjuntos:",
    lista(adjuntos),
    "",
    "Quedamos atentos a cualquier observación.",
    "",
    "Cordialmente,",
    razonSocial,
    "",
  ].join("\n");

export const envioSimuladoMd = (d: {
  caso: string;
  cliente: string;
  fechaEjecucion: string;
  listo: boolean;
  ts: string;
}): string =>
  [
    `# ENVÍO SIMULADO - ${d.caso}`,
    "",
    "> Este archivo es una simulación. No se envió nada al cliente ni se firmó ningún documento.",
    "",
    `- Cliente: ${d.cliente}`,
    `- Registrado: ${d.ts}`,
    `- Fecha de ejecución: ${d.fechaEjecucion}`,
    `- Estado del paquete al simular: ${d.listo ? "listo para firma" : "NO listo para firma"}`,
    `- Paquete: out/${d.caso}/paquete/`,
    "",
  ].join("\n");
