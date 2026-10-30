import { BadRequestException, Controller, Get, Inject, Param } from "@nestjs/common";
import type { ListarCasosUseCase } from "../../../application/solicitud/listar-casos.usecase";
import type { SessionStore } from "../../../application/ports/agente";
import { TOKENS } from "../../../infrastructure/config/tokens";
import { sessionIdSchema } from "../dto";

@Controller("api")
export class SessionsController {
  constructor(
    @Inject(TOKENS.SESIONES) private readonly sesiones: SessionStore,
    @Inject(TOKENS.LISTAR_CASOS) private readonly casos: ListarCasosUseCase,
  ) {}

  @Get("sessions/:id")
  historial(@Param("id") id: string) {
    if (!sessionIdSchema.safeParse(id).success) throw new BadRequestException("sessionId inválido");
    if (!this.sesiones.existe(id)) return { sessionId: id, historial: [] };
    const sesion = this.sesiones.obtener(id);
    return { sessionId: id, historial: sesion.historial, tokens: sesion.tokensUsados };
  }

  @Get("casos")
  async listarCasos() {
    return { casos: await this.casos.ejecutar() };
  }
}
