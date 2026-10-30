export type EstadoSoporte = "presente" | "ausente" | "vencido";

export interface SoporteRegistrado {
  tipo: string;
  archivo: string;
  vigenciaHasta: string | null;
  paisEmisor: string;
  descripcion: string;
  existeArchivo: boolean;
}

export interface SoporteEvaluado {
  tipo: string;
  estado: EstadoSoporte;
  vigenciaHasta: string | null;
  archivo?: string;
  venceProntoEnDias?: number;
  aviso?: "vence_pronto";
  nota?: string;
}
