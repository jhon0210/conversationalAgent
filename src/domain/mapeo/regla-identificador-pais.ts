import type { CodigoPais } from "../solicitud/solicitud";
import type { CampoMapeado } from "./estado-campo";
import { normalizar } from "./glosario-resolver";

// RN1: identificador tributario por país.
export const IDENTIFICADOR_POR_PAIS: Record<CodigoPais, string> = {
  CO: "NIT",
  EC: "RUC",
  PE: "RUC",
  PA: "RUC",
  HN: "RTN",
};

const ETIQUETAS_GENERICAS = new Set(["identificacion tributaria", "numero de identificacion fiscal"]);

export const esEtiquetaTributariaGenerica = (etiqueta: string): boolean =>
  ETIQUETAS_GENERICAS.has(normalizar(etiqueta));

export const aplicarReglaIdentificador = (campo: CampoMapeado, pais: CodigoPais): CampoMapeado => {
  if (campo.rutaMaestro !== "nit" || campo.estado === "faltante") return campo;

  const equivalente = IDENTIFICADOR_POR_PAIS[pais];
  const notas: string[] = [];
  if (esEtiquetaTributariaGenerica(campo.etiqueta)) {
    notas.push(`Etiqueta genérica: en ${pais} el equivalente es ${equivalente}`);
  }
  if (pais !== "CO") {
    notas.push(`identificador extranjero (se usa el NIT colombiano; en ${pais} corresponde ${equivalente})`);
  }
  if (notas.length === 0) return campo;

  return { ...campo, estado: "requiere_confirmacion", nota: notas.join(". ") };
};
