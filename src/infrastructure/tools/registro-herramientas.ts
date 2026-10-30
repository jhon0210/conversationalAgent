import { z } from "zod";
import type { RegistroHerramientas } from "../../application/ports/agente";
import type { DefinicionHerramienta } from "../../application/ports/llm";
import * as proveedor from "./proveedor";

type Herramienta = (typeof proveedor)[keyof typeof proveedor];

// Contrato del PRD: el nombre que ve el modelo es <archivo>_<export>.
const catalogo = (): Map<string, Herramienta> =>
  new Map(Object.entries(proveedor).map(([exportado, h]) => [`proveedor_${exportado}`, h as Herramienta]));

export class RegistroHerramientasProveedor implements RegistroHerramientas {
  private readonly herramientas = catalogo();

  definiciones(): DefinicionHerramienta[] {
    return [...this.herramientas].map(([name, h]) => {
      const { $schema: _omitido, ...inputSchema } = z.toJSONSchema(z.object(h.args)) as Record<string, unknown>;
      return { name, description: h.description, inputSchema };
    });
  }

  async ejecutar(nombre: string, args: unknown, ctx: { directory: string; sessionId: string }): Promise<string> {
    const herramienta = this.herramientas.get(nombre);
    if (!herramienta) return JSON.stringify({ ok: false, error: `La herramienta "${nombre}" no existe` });
    // El backend valida con zod dentro de execute; nunca lanza.
    return (herramienta.execute as (a: unknown, c: typeof ctx) => Promise<string>)(args, ctx);
  }
}
