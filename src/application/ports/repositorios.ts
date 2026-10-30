import type { Maestro } from "../../domain/mapeo/ruta-maestro";
import type { Glosario } from "../../domain/mapeo/glosario-resolver";
import type { Caso } from "../../domain/solicitud/solicitud";
import type { SoporteRegistrado } from "../../domain/soporte/soporte";

export interface CasoRepo {
  cargar(caso: string): Promise<Caso>;
  listar(): Promise<string[]>;
}

export interface MaestroRepo {
  obtener(): Promise<Maestro>;
  obtenerGlosario(): Promise<Glosario>;
}

export interface SoporteRepo {
  buscar(tipo: string): Promise<SoporteRegistrado | undefined>;
}
