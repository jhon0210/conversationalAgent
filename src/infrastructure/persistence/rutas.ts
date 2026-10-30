import path from "node:path";
import { AppError } from "../../domain/shared/errores";

export interface Rutas {
  raiz: string;
  casos: string;
  repositorio: string;
  soportes: string;
  salida: string;
}

export const construirRutas = (directory: string): Rutas => {
  const raiz = path.resolve(directory);
  const repositorio = path.join(raiz, "fixtures", "reto-01", "repositorio");
  return {
    raiz,
    casos: path.join(raiz, "fixtures", "reto-01", "casos"),
    repositorio,
    soportes: path.join(repositorio, "soportes"),
    salida: path.join(raiz, "out"),
  };
};

const NOMBRE_SEGURO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Evita path traversal: solo nombres simples dentro de la carpeta base.
export const resolverDentro = (base: string, nombre: string): string => {
  if (!NOMBRE_SEGURO.test(nombre) || nombre.includes("..")) {
    throw new AppError(`Nombre no válido: "${nombre}"`, "NOMBRE_INVALIDO");
  }
  const completo = path.resolve(base, nombre);
  if (path.dirname(completo) !== path.resolve(base)) {
    throw new AppError(`Nombre no válido: "${nombre}"`, "NOMBRE_INVALIDO");
  }
  return completo;
};

export const resolverRelativaEnSalida = (salida: string, relativa: string): string => {
  const completo = path.resolve(salida, relativa);
  if (!completo.startsWith(path.resolve(salida) + path.sep)) {
    throw new AppError("Ruta de salida no válida", "RUTA_INVALIDA");
  }
  return completo;
};
