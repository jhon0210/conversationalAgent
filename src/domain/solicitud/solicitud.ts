export type FormatoSalida = "xlsx" | "pdf" | "portal";
export type CodigoPais = "CO" | "EC" | "PE" | "PA" | "HN";

export interface Solicitud {
  id: string;
  de: string;
  asunto: string;
  fecha: string;
  pais: CodigoPais;
  cliente: string;
  cuerpo: string;
  formato: FormatoSalida;
  adjuntos: string[];
}

export interface CampoSolicitado {
  etiqueta: string;
  obligatorio?: boolean;
  hoja?: string;
  celdaEtiqueta?: string;
  celdaValor?: string;
}

export interface Caso {
  solicitud: Solicitud;
  campos: CampoSolicitado[];
  soportesExigidos: string[];
}
