import { promises as fs } from "node:fs";
import path from "node:path";
import type { SalidaRepo } from "../../application/ports/salida";
import { resolverDentro, resolverRelativaEnSalida, type Rutas } from "./rutas";

export class FsSalidaRepo implements SalidaRepo {
  constructor(private readonly rutas: Rutas) {}

  async escribirTexto(destino: string, contenido: string): Promise<void> {
    const ruta = resolverRelativaEnSalida(this.rutas.salida, destino);
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    await fs.writeFile(ruta, contenido, "utf8");
  }

  async copiarDesdeSoportes(archivo: string, destino: string): Promise<void> {
    const origen = resolverDentro(this.rutas.soportes, archivo);
    await this.copiar(origen, resolverRelativaEnSalida(this.rutas.salida, destino));
  }

  async copiarEnSalida(origen: string, destino: string): Promise<void> {
    await this.copiar(
      resolverRelativaEnSalida(this.rutas.salida, origen),
      resolverRelativaEnSalida(this.rutas.salida, destino),
    );
  }

  async existe(destino: string): Promise<boolean> {
    try {
      await fs.access(resolverRelativaEnSalida(this.rutas.salida, destino));
      return true;
    } catch {
      return false;
    }
  }

  private async copiar(origen: string, destino: string): Promise<void> {
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.copyFile(origen, destino);
  }
}
