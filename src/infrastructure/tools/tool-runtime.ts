import { z } from "zod";
import { AppError } from "../../domain/shared/errores";
import { obtenerContenedor, type Contenedor } from "../config/container";

export interface ToolContext {
  directory: string;
  sessionId: string;
}

export interface ResultadoHerramienta {
  data: unknown;
  resumen: string;
}

interface Definicion<S extends z.ZodRawShape> {
  nombre: string;
  description: string;
  args: S;
  run(args: z.infer<z.ZodObject<S>>, contenedor: Contenedor, ctx: ToolContext): Promise<ResultadoHerramienta>;
}

const mensajeDeError = (error: unknown): string => {
  if (error instanceof AppError) return error.message;
  if (error instanceof z.ZodError) {
    const campos = error.issues.map((i) => i.path.join(".") || "(raíz)").join(", ");
    return `Argumentos inválidos en: ${campos}`;
  }
  return "Error interno al ejecutar la herramienta";
};

const casoDe = (args: unknown): string | undefined => {
  const caso = (args as { caso?: unknown } | null)?.caso;
  return typeof caso === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(caso) && !caso.includes("..")
    ? caso
    : undefined;
};

// Contrato del PRD: execute devuelve siempre un string JSON y nunca lanza.
export const definirHerramienta = <S extends z.ZodRawShape>(def: Definicion<S>) => ({
  description: def.description,
  args: def.args,
  async execute(args: z.input<z.ZodObject<S>>, ctx: ToolContext): Promise<string> {
    let contenedor: Contenedor | undefined;
    try {
      contenedor = obtenerContenedor(ctx.directory);
      const parsed = z.object(def.args).parse(args);
      const { data, resumen } = await def.run(parsed, contenedor, ctx);
      await contenedor.audit.registrar({ caso: casoDe(args), herramienta: def.nombre, ok: true, resumen });
      return JSON.stringify({ ok: true, data });
    } catch (error) {
      const mensaje = mensajeDeError(error);
      await contenedor?.audit.registrar({ caso: casoDe(args), herramienta: def.nombre, ok: false, resumen: mensaje });
      return JSON.stringify({ ok: false, error: mensaje });
    }
  },
});
