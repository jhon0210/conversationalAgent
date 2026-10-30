import { promises as fs } from "node:fs";
import path from "node:path";
import type { CasoRepo } from "../../application/ports/repositorios";
import { AppError } from "../../domain/shared/errores";
import type { Caso, CampoSolicitado } from "../../domain/solicitud/solicitud";
import {
  plantillaCamposSchema,
  plantillaCeldasSchema,
  soportesExigidosSchema,
  solicitudSchema,
} from "./esquemas";
import { existeArchivo, leerJson } from "./lector-json";
import { resolverDentro, type Rutas } from "./rutas";

export class FsCasoRepo implements CasoRepo {
  constructor(private readonly rutas: Rutas) {}

  async listar(): Promise<string[]> {
    try {
      const entradas = await fs.readdir(this.rutas.casos, { withFileTypes: true });
      return entradas.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    } catch {
      return [];
    }
  }

  async cargar(nombre: string): Promise<Caso> {
    const carpeta = resolverDentro(this.rutas.casos, nombre);
    if (!(await existeArchivo(carpeta))) {
      throw new AppError(`El caso "${nombre}" no existe`, "CASO_NO_ENCONTRADO");
    }

    const solicitud = await leerJson(path.join(carpeta, "solicitud.json"), solicitudSchema, "la solicitud del caso");
    const soportesExigidos = await leerJson(
      path.join(carpeta, "soportes-exigidos.json"),
      soportesExigidosSchema,
      "la lista de soportes exigidos",
    );

    return { solicitud, soportesExigidos, campos: await this.cargarCampos(carpeta, solicitud.formato) };
  }

  private async cargarCampos(carpeta: string, formato: Caso["solicitud"]["formato"]): Promise<CampoSolicitado[]> {
    if (formato === "xlsx") {
      const celdas = await leerJson(path.join(carpeta, "plantilla-celdas.json"), plantillaCeldasSchema, "la plantilla de celdas");
      return celdas.map((c) => ({
        etiqueta: c.etiqueta,
        hoja: c.hoja,
        celdaEtiqueta: c.celda_etiqueta,
        celdaValor: c.celda_valor,
      }));
    }
    const campos = await leerJson(path.join(carpeta, "plantilla-campos.json"), plantillaCamposSchema, "la plantilla de campos");
    return campos.map((c) => ({ etiqueta: c.etiqueta, obligatorio: c.obligatorio }));
  }
}
