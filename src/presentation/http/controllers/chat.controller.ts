import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AppError } from "../../../domain/shared/errores";
import type { EjecutarTurnoUseCase } from "../../../application/agente/ejecutar-turno.usecase";
import { TOKENS } from "../../../infrastructure/config/tokens";
import { chatBodySchema } from "../dto";
import { LimiteGuard } from "../limite.guard";

const INTERVALO_LATIDO_MS = 15_000;

@Controller("api/chat")
@UseGuards(LimiteGuard)
export class ChatController {
  constructor(@Inject(TOKENS.EJECUTAR_TURNO) private readonly turno: EjecutarTurnoUseCase) {}

  private validar(body: unknown) {
    const parsed = chatBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Solicitud inválida");
    return parsed.data;
  }

  @Post()
  async chat(@Body() body: unknown) {
    const datos = this.validar(body);
    try {
      return await this.turno.ejecutar(datos);
    } catch (error) {
      if (error instanceof AppError) {
        const estado = error.codigo === "SESION_OCUPADA" ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        throw new HttpException(error.message, estado);
      }
      throw error;
    }
  }

  // Server-Sent Events: cada herramienta se publica apenas ocurre; al final llega el evento "fin".
  @Post("stream")
  async stream(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const datos = this.validar(body);

    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let abierto = true;
    res.on("close", () => {
      abierto = false;
    });
    const enviar = (evento: string, payload: unknown): void => {
      if (abierto) res.write(`event: ${evento}\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    // Los proxies cierran conexiones inactivas; el latido mantiene viva la llamada larga al modelo.
    const latido = setInterval(() => {
      if (abierto) res.write(": latido\n\n");
    }, INTERVALO_LATIDO_MS);

    try {
      const respuesta = await this.turno.ejecutar(datos, (evento) => enviar(evento.tipo, evento));
      enviar("fin", respuesta);
    } catch (error) {
      const mensaje = error instanceof AppError ? error.message : "Ocurrió un error interno. Intenta de nuevo.";
      enviar("fallo", { mensaje });
    } finally {
      clearInterval(latido);
      res.end();
    }
  }
}
