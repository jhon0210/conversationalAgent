import type { CasoRepo } from "../ports/repositorios";

export interface ResumenCaso {
  caso: string;
  cliente: string;
  pais: string;
  formato: string;
}

export class ListarCasosUseCase {
  constructor(private readonly casos: CasoRepo) {}

  async ejecutar(): Promise<ResumenCaso[]> {
    const nombres = await this.casos.listar();
    return Promise.all(
      nombres.map(async (caso): Promise<ResumenCaso> => {
        try {
          const { solicitud } = await this.casos.cargar(caso);
          return { caso, cliente: solicitud.cliente, pais: solicitud.pais, formato: solicitud.formato };
        } catch {
          return { caso, cliente: "Caso con archivos inválidos", pais: "", formato: "" };
        }
      }),
    );
  }
}
