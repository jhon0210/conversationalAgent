import { clasificarCampo } from "../../domain/mapeo/clasificar-campo";
import type { CampoMapeado } from "../../domain/mapeo/estado-campo";
import { enmascararSiSensible, valorPorRuta } from "../../domain/mapeo/ruta-maestro";
import type { CodigoPais } from "../../domain/solicitud/solicitud";
import type { CasoRepo, MaestroRepo } from "../ports/repositorios";

export interface CampoConValor {
  campo: CampoMapeado;
  valor: unknown;
}

export interface EntradaMapeo {
  etiqueta: string;
  estado: CampoMapeado["estado"];
  ruta_maestro?: string;
}

export interface ResultadoMapeo {
  caso: string;
  pais: CodigoPais;
  llenos: { etiqueta: string; ruta_maestro: string; valor: unknown }[];
  faltantes: { etiqueta: string; motivo: string }[];
  requiere_confirmacion: {
    etiqueta: string;
    ruta_maestro?: string;
    motivo: string;
    valor_propuesto?: unknown;
  }[];
  todos: EntradaMapeo[];
}

export class MapearCamposUseCase {
  constructor(
    private readonly casos: CasoRepo,
    private readonly maestro: MaestroRepo,
  ) {}

  // Clasifica etiquetas; si no se pasan, usa las de la plantilla del caso.
  async clasificar(caso: string, etiquetas?: string[]): Promise<{ pais: CodigoPais; items: CampoConValor[] }> {
    const [datos, maestro, glosario] = await Promise.all([
      this.casos.cargar(caso),
      this.maestro.obtener(),
      this.maestro.obtenerGlosario(),
    ]);
    const lista = etiquetas ?? datos.campos.map((c) => c.etiqueta);
    const pais = datos.solicitud.pais;
    const items = lista.map((etiqueta) => {
      const campo = clasificarCampo(etiqueta, { glosario, maestro, pais });
      const valor = campo.rutaMaestro ? valorPorRuta(maestro, campo.rutaMaestro) : undefined;
      return { campo, valor };
    });
    return { pais, items };
  }

  async ejecutar(entrada: { caso: string; campos: string[] }): Promise<ResultadoMapeo> {
    const { pais, items } = await this.clasificar(entrada.caso, entrada.campos);
    const resultado: ResultadoMapeo = {
      caso: entrada.caso,
      pais,
      llenos: [],
      faltantes: [],
      requiere_confirmacion: [],
      todos: [],
    };

    for (const { campo, valor } of items) {
      resultado.todos.push({ etiqueta: campo.etiqueta, estado: campo.estado, ruta_maestro: campo.rutaMaestro });
      const visible = campo.rutaMaestro ? enmascararSiSensible(campo.rutaMaestro, valor) : undefined;
      if (campo.estado === "lleno" && campo.rutaMaestro) {
        resultado.llenos.push({ etiqueta: campo.etiqueta, ruta_maestro: campo.rutaMaestro, valor: visible });
      } else if (campo.estado === "faltante") {
        resultado.faltantes.push({ etiqueta: campo.etiqueta, motivo: campo.nota ?? "Sin fuente en el maestro" });
      } else {
        resultado.requiere_confirmacion.push({
          etiqueta: campo.etiqueta,
          ruta_maestro: campo.rutaMaestro,
          motivo: campo.nota ?? "Requiere confirmación",
          valor_propuesto: visible,
        });
      }
    }
    return resultado;
  }
}
