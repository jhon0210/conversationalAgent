import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 30;

// Límite simple por IP para que nadie gaste la clave del modelo sin tope.
@Injectable()
export class LimiteGuard implements CanActivate {
  private readonly contadores = new Map<string, { inicio: number; n: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ ip?: string }>();
    const ip = req.ip ?? "desconocida";
    const ahora = Date.now();
    const actual = this.contadores.get(ip);
    if (!actual || ahora - actual.inicio > VENTANA_MS) {
      this.contadores.set(ip, { inicio: ahora, n: 1 });
      return true;
    }
    actual.n += 1;
    if (actual.n > MAX_POR_VENTANA) {
      throw new HttpException("Demasiadas solicitudes. Espera un minuto e intenta de nuevo.", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
