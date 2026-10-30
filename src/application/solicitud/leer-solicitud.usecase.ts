import type { CasoRepo } from "../ports/repositorios";

export interface ResultadoLeerSolicitud {
  caso: string;
  pais: string;
  cliente: string;
  formato: string;
  asunto: string;
  fecha_solicitud: string;
  campos: string[];
  soportes: string[];
}

export class LeerSolicitudUseCase {
  constructor(private readonly casos: CasoRepo) {}

  async ejecutar(caso: string): Promise<ResultadoLeerSolicitud> {
    const { solicitud, campos, soportesExigidos } = await this.casos.cargar(caso);
    return {
      caso,
      pais: solicitud.pais,
      cliente: solicitud.cliente,
      formato: solicitud.formato,
      asunto: solicitud.asunto,
      fecha_solicitud: solicitud.fecha,
      campos: campos.map((c) => c.etiqueta),
      soportes: soportesExigidos,
    };
  }
}
