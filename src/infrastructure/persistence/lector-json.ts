import { promises as fs } from "node:fs";
import type { z } from "zod";
import { AppError } from "../../domain/shared/errores";

export const leerJson = async <T>(ruta: string, schema: z.ZodType<T>, descripcion: string): Promise<T> => {
  let texto: string;
  try {
    texto = await fs.readFile(ruta, "utf8");
  } catch {
    throw new AppError(`No se encontró ${descripcion}`, "ARCHIVO_NO_ENCONTRADO");
  }
  let json: unknown;
  try {
    json = JSON.parse(texto.replace(/^\uFEFF/, ""));
  } catch {
    throw new AppError(`${descripcion} está corrupto o no es JSON válido`, "JSON_CORRUPTO");
  }
  const resultado = schema.safeParse(json);
  if (!resultado.success) {
    throw new AppError(`${descripcion} no tiene la estructura esperada`, "ESTRUCTURA_INVALIDA");
  }
  return resultado.data;
};

export const existeArchivo = async (ruta: string): Promise<boolean> => {
  try {
    await fs.access(ruta);
    return true;
  } catch {
    return false;
  }
};
