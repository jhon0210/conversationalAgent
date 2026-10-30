import path from "node:path";
import type { MaestroRepo, SoporteRepo } from "../../application/ports/repositorios";
import type { Glosario } from "../../domain/mapeo/glosario-resolver";
import type { Maestro } from "../../domain/mapeo/ruta-maestro";
import type { SoporteRegistrado } from "../../domain/soporte/soporte";
import { glosarioSchema, indiceSoportesSchema, maestroSchema } from "./esquemas";
import { existeArchivo, leerJson } from "./lector-json";
import { resolverDentro, type Rutas } from "./rutas";

export class FsMaestroRepo implements MaestroRepo {
  constructor(private readonly rutas: Rutas) {}

  obtener(): Promise<Maestro> {
    return leerJson(path.join(this.rutas.repositorio, "maestro.json"), maestroSchema, "el repositorio maestro");
  }

  obtenerGlosario(): Promise<Glosario> {
    return leerJson(
      path.join(this.rutas.raiz, "fixtures", "reto-01", "glosario-campos.json"),
      glosarioSchema,
      "el glosario de campos",
    );
  }
}

export class FsSoporteRepo implements SoporteRepo {
  constructor(private readonly rutas: Rutas) {}

  async buscar(tipo: string): Promise<SoporteRegistrado | undefined> {
    const indice = await leerJson(path.join(this.rutas.soportes, "index.json"), indiceSoportesSchema, "el índice de soportes");
    const entrada = indice.find((s) => s.tipo === tipo);
    if (!entrada) return undefined;

    let existeArchivoSoporte = false;
    try {
      existeArchivoSoporte = await existeArchivo(resolverDentro(this.rutas.soportes, entrada.archivo));
    } catch {
      existeArchivoSoporte = false;
    }
    return {
      tipo: entrada.tipo,
      archivo: entrada.archivo,
      vigenciaHasta: entrada.vigencia_hasta,
      paisEmisor: entrada.pais_emisor,
      descripcion: entrada.descripcion,
      existeArchivo: existeArchivoSoporte,
    };
  }
}
