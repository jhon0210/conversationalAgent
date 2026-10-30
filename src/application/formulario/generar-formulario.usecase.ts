import { AppError } from "../../domain/shared/errores";
import type { CampoMapeado } from "../../domain/mapeo/estado-campo";
import type { FormatoSalida } from "../../domain/solicitud/solicitud";
import type { MapearCamposUseCase, EntradaMapeo } from "../mapeo/mapear-campos.usecase";
import type { CasoRepo } from "../ports/repositorios";
import type { FilaFormulario, FormularioWriter, ValorFormulario } from "../ports/salida";

export interface EntradaGenerar {
  caso: string;
  mapeo?: unknown;
}

export interface ResultadoGenerar {
  ruta: string;
  formato: FormatoSalida;
  aviso?: string;
  campos_llenos: number;
  campos_faltantes: string[];
  campos_requieren_confirmacion: string[];
  discrepancias_mapeo: number;
}

const NOMBRE_ARCHIVO: Record<FormatoSalida, string> = {
  xlsx: "formulario.xlsx",
  pdf: "formulario.pdf",
  portal: "valores-portal.md",
};

const aValorFormulario = (valor: unknown): ValorFormulario => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") return valor;
  return JSON.stringify(valor);
};

// Acepta el arreglo `todos` o el objeto completo devuelto por proveedor_mapear_campos.
const extraerEntradas = (mapeo: unknown): EntradaMapeo[] => {
  if (Array.isArray(mapeo)) return mapeo as EntradaMapeo[];
  if (mapeo && typeof mapeo === "object") {
    const todos = (mapeo as { todos?: unknown }).todos;
    if (Array.isArray(todos)) return todos as EntradaMapeo[];
  }
  return [];
};

export class GenerarFormularioUseCase {
  constructor(
    private readonly casos: CasoRepo,
    private readonly mapear: MapearCamposUseCase,
    private readonly writer: FormularioWriter,
  ) {}

  async ejecutar(entrada: EntradaGenerar): Promise<ResultadoGenerar> {
    const { solicitud, campos } = await this.casos.cargar(entrada.caso);
    if (campos.length === 0) throw new AppError("El caso no tiene plantilla de campos para generar el formulario", "PLANTILLA_VACIA");

    // CA2: los valores se recalculan desde el maestro; lo que envíe el modelo solo se contrasta.
    const { items } = await this.mapear.clasificar(entrada.caso);
    const discrepancias = this.contarDiscrepancias(items.map((i) => i.campo), extraerEntradas(entrada.mapeo));

    const filas: FilaFormulario[] = campos.map((campo, i) => {
      const { campo: mapeado, valor } = items[i]!;
      return {
        etiqueta: campo.etiqueta,
        valor: mapeado.estado === "faltante" ? null : aValorFormulario(valor),
        estado: mapeado.estado,
        nota: mapeado.nota,
        obligatorio: campo.obligatorio,
        hoja: campo.hoja,
        celdaEtiqueta: campo.celdaEtiqueta,
        celdaValor: campo.celdaValor,
      };
    });

    const archivo = NOMBRE_ARCHIVO[solicitud.formato];
    const destino = `${entrada.caso}/${archivo}`;
    const titulo = `Registro como proveedor - ${solicitud.cliente}`;
    let aviso: string | undefined;

    if (solicitud.formato === "xlsx") {
      if (filas.some((f) => !f.hoja || !f.celdaEtiqueta || !f.celdaValor)) {
        throw new AppError("La plantilla Excel no define hoja o celdas para todos los campos", "PLANTILLA_INVALIDA");
      }
      await this.writer.escribirXlsx(destino, filas);
    } else if (solicitud.formato === "pdf") {
      await this.writer.escribirPdf(destino, titulo, filas);
    } else {
      await this.writer.escribirPortal(destino, titulo, filas);
      aviso =
        "formato no soportado: portal web. Se generó valores-portal.md para copiar; el ingreso de credenciales y el envío los hace una persona.";
    }

    return {
      ruta: `out/${destino}`,
      formato: solicitud.formato,
      aviso,
      campos_llenos: items.filter((i) => i.campo.estado === "lleno").length,
      campos_faltantes: items.filter((i) => i.campo.estado === "faltante").map((i) => i.campo.etiqueta),
      campos_requieren_confirmacion: items
        .filter((i) => i.campo.estado === "requiere_confirmacion")
        .map((i) => i.campo.etiqueta),
      discrepancias_mapeo: discrepancias,
    };
  }

  private contarDiscrepancias(reales: CampoMapeado[], recibidas: EntradaMapeo[]): number {
    if (recibidas.length === 0) return 0;
    const porEtiqueta = new Map(recibidas.map((e) => [e.etiqueta, e]));
    return reales.filter((r) => {
      const e = porEtiqueta.get(r.etiqueta);
      return !e || e.estado !== r.estado || (e.ruta_maestro ?? undefined) !== r.rutaMaestro;
    }).length;
  }
}
