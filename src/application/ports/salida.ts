import type { EstadoCampo } from "../../domain/mapeo/estado-campo";

export type ValorFormulario = string | number | boolean | null;

export interface FilaFormulario {
  etiqueta: string;
  valor: ValorFormulario;
  estado: EstadoCampo;
  nota?: string;
  obligatorio?: boolean;
  hoja?: string;
  celdaEtiqueta?: string;
  celdaValor?: string;
}

// Todas las rutas son relativas a out/.
export interface FormularioWriter {
  escribirXlsx(destino: string, filas: FilaFormulario[]): Promise<void>;
  escribirPdf(destino: string, titulo: string, filas: FilaFormulario[]): Promise<void>;
  escribirPortal(destino: string, titulo: string, filas: FilaFormulario[]): Promise<void>;
}

export interface SalidaRepo {
  escribirTexto(destino: string, contenido: string): Promise<void>;
  copiarDesdeSoportes(archivo: string, destino: string): Promise<void>;
  copiarEnSalida(origen: string, destino: string): Promise<void>;
  existe(destino: string): Promise<boolean>;
}
