import type { SoporteEvaluado, SoporteRegistrado } from "./soporte";

const MS_DIA = 86_400_000;

const aUtc = (fechaIso: string): number => {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return Date.UTC(anio ?? 0, (mes ?? 1) - 1, dia ?? 1);
};

export const diasHasta = (hoy: string, vigenciaHasta: string): number =>
  Math.round((aUtc(vigenciaHasta) - aUtc(hoy)) / MS_DIA);

// Vencido = vigencia_hasta anterior a la fecha de ejecución. El mismo día sigue vigente.
export const evaluarSoporte = (
  tipo: string,
  registro: SoporteRegistrado | undefined,
  hoy: string,
  diasAviso: number,
): SoporteEvaluado => {
  if (!registro) {
    return { tipo, estado: "ausente", vigenciaHasta: null, nota: "No existe en el repositorio de soportes" };
  }
  if (!registro.existeArchivo) {
    return {
      tipo,
      estado: "ausente",
      vigenciaHasta: registro.vigenciaHasta,
      nota: `Registrado en el índice pero falta el archivo ${registro.archivo}`,
    };
  }

  const base = { tipo, archivo: registro.archivo, vigenciaHasta: registro.vigenciaHasta };
  if (registro.vigenciaHasta === null) return { ...base, estado: "presente" };

  const dias = diasHasta(hoy, registro.vigenciaHasta);
  if (dias < 0) return { ...base, estado: "vencido", nota: `Venció hace ${Math.abs(dias)} día(s)` };
  if (dias < diasAviso) {
    return { ...base, estado: "presente", aviso: "vence_pronto", venceProntoEnDias: dias };
  }
  return { ...base, estado: "presente" };
};
