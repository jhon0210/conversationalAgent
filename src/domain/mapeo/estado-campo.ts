export type EstadoCampo = "lleno" | "faltante" | "requiere_confirmacion";

export interface CampoMapeado {
  etiqueta: string;
  estado: EstadoCampo;
  rutaMaestro?: string;
  confianza: number;
  nota?: string;
}

export const UMBRAL_CONFIANZA = 0.8;
export const UMBRAL_PROPUESTA = 0.6;
