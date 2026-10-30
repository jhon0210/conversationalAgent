import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

interface RespuestaHttp {
  status(codigo: number): { json(cuerpo: unknown): void };
}

// CA5: errores en lenguaje claro y sin trazas.
@Catch()
export class FiltroErrores implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<RespuestaHttp>();
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse();
      const mensaje = typeof cuerpo === "string" ? cuerpo : ((cuerpo as { message?: string | string[] }).message ?? error.message);
      res.status(error.getStatus()).json({ error: Array.isArray(mensaje) ? mensaje.join(", ") : mensaje });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Ocurrió un error interno. Intenta de nuevo." });
  }
}
