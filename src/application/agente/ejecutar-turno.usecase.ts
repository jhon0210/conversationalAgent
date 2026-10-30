import { AppError } from "../../domain/shared/errores";
import type { Bloque, BloqueToolResult, Mensaje } from "../../domain/conversacion/mensaje";
import type { EntradaHistorial, LlamadaHerramientaVista } from "../../domain/conversacion/sesion";
import type { PromptProvider, RegistroHerramientas, SessionStore } from "../ports/agente";
import { LlmError, type LlmProvider } from "../ports/llm";
import type { ConfirmacionStore } from "../ports/servicios";

export interface ConfigAgente {
  maxIteraciones: number;
  maxTokensSesion: number;
  llmTimeoutMs: number;
  maxLongitudMensaje: number;
  directory: string;
}

export interface RespuestaTurno {
  reply: string;
  toolCalls: LlamadaHerramientaVista[];
  needsConfirmation: boolean;
  esError: boolean;
  uso: { tokens: number; maximo: number };
}

const MARCADOR_CONFIRMACION = /CONFIRMACI[OÓ]N REQUERIDA/i;

// Eventos de progreso que el turno emite mientras se ejecuta (para streaming).
export type EventoTurno =
  | { tipo: "estado"; texto: string }
  | { tipo: "herramienta_inicio"; id: string; nombre: string; args: Record<string, unknown> }
  | { tipo: "herramienta"; llamada: LlamadaHerramientaVista };

export type AlEvento = (evento: EventoTurno) => void;

const recortar = (texto: string, max: number): string => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

// Resumen genérico y corto de un resultado de herramienta para el chat.
export const resumirResultado = (json: string): { ok: boolean; resumen: string } => {
  try {
    const r = JSON.parse(json) as { ok: boolean; data?: Record<string, unknown>; error?: string };
    if (!r.ok) return { ok: false, resumen: r.error ?? "error" };
    const partes = Object.entries(r.data ?? {}).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}[${v.length}]`;
      if (v !== null && typeof v === "object") return `${k}{…}`;
      return `${k}=${String(v)}`;
    });
    return { ok: true, resumen: recortar(partes.join(" · "), 220) };
  } catch {
    return { ok: false, resumen: "resultado no legible" };
  }
};

export class EjecutarTurnoUseCase {
  constructor(
    private readonly llm: LlmProvider,
    private readonly herramientas: RegistroHerramientas,
    private readonly sesiones: SessionStore,
    private readonly prompt: PromptProvider,
    private readonly confirmaciones: ConfirmacionStore,
    private readonly config: ConfigAgente,
  ) {}

  async ejecutar(entrada: { sessionId: string; message: string }, alEvento?: AlEvento): Promise<RespuestaTurno> {
    const texto = entrada.message.trim();
    if (!texto) throw new AppError("El mensaje está vacío", "MENSAJE_VACIO");
    if (texto.length > this.config.maxLongitudMensaje) {
      throw new AppError(`El mensaje supera ${this.config.maxLongitudMensaje} caracteres`, "MENSAJE_LARGO");
    }

    const sesion = this.sesiones.obtener(entrada.sessionId);
    if (sesion.ocupada) throw new AppError("Esta sesión ya tiene una solicitud en curso. Espera la respuesta.", "SESION_OCUPADA");
    sesion.ocupada = true;
    try {
      return await this.turno(entrada.sessionId, texto, alEvento);
    } finally {
      sesion.ocupada = false;
    }
  }

  private async turno(sessionId: string, texto: string, alEvento?: AlEvento): Promise<RespuestaTurno> {
    // Un cliente desconectado no debe romper el turno: el estado de la sesión debe quedar consistente.
    const emitir: AlEvento = (evento) => {
      try {
        alEvento?.(evento);
      } catch {
        /* sin efecto */
      }
    };
    const sesion = this.sesiones.obtener(sessionId);
    const uso = () => ({ tokens: sesion.tokensUsados, maximo: this.config.maxTokensSesion });
    const ts = () => new Date().toISOString();

    sesion.historial.push({ rol: "user", texto, toolCalls: [], needsConfirmation: false, ts: ts() });
    this.confirmaciones.avanzarTurno(sessionId);

    const cerrar = (rol: EntradaHistorial["rol"], reply: string, toolCalls: LlamadaHerramientaVista[], needs: boolean): RespuestaTurno => {
      sesion.historial.push({ rol, texto: reply, toolCalls, needsConfirmation: needs, ts: ts() });
      return { reply, toolCalls, needsConfirmation: needs, esError: rol === "error", uso: uso() };
    };

    if (sesion.tokensUsados >= this.config.maxTokensSesion) {
      return cerrar("error", "Se alcanzó el límite de uso de esta sesión. Inicia una conversación nueva para continuar.", [], false);
    }

    sesion.mensajes.push({ role: "user", content: texto });
    const vistas: LlamadaHerramientaVista[] = [];
    const system = await this.prompt.cargar();
    const definiciones = this.herramientas.definiciones();
    let armoPaquete = false;
    let simulo = false;

    for (let i = 0; i < this.config.maxIteraciones; i++) {
      let respuesta;
      emitir({ tipo: "estado", texto: i === 0 ? "El modelo está analizando tu solicitud…" : "El modelo está revisando los resultados…" });
      try {
        respuesta = await this.llm.enviar(sesion.mensajes, definiciones, { system, timeoutMs: this.config.llmTimeoutMs });
      } catch (error) {
        const mensaje = error instanceof LlmError ? error.message : "No pude comunicarme con el modelo de lenguaje. Intenta de nuevo.";
        // Mantiene la alternancia de roles para que la sesión siga viva.
        sesion.mensajes.push({ role: "assistant", content: `[Error del sistema] ${mensaje}` });
        return cerrar("error", mensaje, vistas, false);
      }

      sesion.tokensUsados += respuesta.usage.input + respuesta.usage.output;
      sesion.mensajes.push({ role: "assistant", content: respuesta.contenido });

      if (respuesta.toolCalls.length === 0) {
        const necesita = MARCADOR_CONFIRMACION.test(respuesta.texto) || (armoPaquete && !simulo);
        return cerrar("assistant", respuesta.texto || "(sin respuesta)", vistas, necesita);
      }

      const resultados: Bloque[] = [];
      for (const llamada of respuesta.toolCalls) {
        const inicio = Date.now();
        emitir({ tipo: "herramienta_inicio", id: llamada.id, nombre: llamada.name, args: llamada.input });
        const salida = await this.herramientas.ejecutar(llamada.name, llamada.input, {
          directory: this.config.directory,
          sessionId,
        });
        const { ok, resumen } = resumirResultado(salida);
        if (ok && llamada.name === "proveedor_armar_paquete") armoPaquete = true;
        if (ok && llamada.name === "proveedor_simular_envio") simulo = true;
        const vista: LlamadaHerramientaVista = {
          id: llamada.id,
          nombre: llamada.name,
          args: llamada.input,
          ok,
          resumen,
          resultado: salida,
          duracionMs: Date.now() - inicio,
        };
        vistas.push(vista);
        emitir({ tipo: "herramienta", llamada: vista });
        const bloque: BloqueToolResult = { type: "tool_result", tool_use_id: llamada.id, content: salida, is_error: !ok };
        resultados.push(bloque);
      }
      sesion.mensajes.push({ role: "user", content: resultados } satisfies Mensaje);

      if (sesion.tokensUsados >= this.config.maxTokensSesion) break;
    }

    // CA1: tope alcanzado; se responde con lo ejecutado.
    const hechas = vistas.map((v) => `${v.nombre}${v.ok ? "" : " (con error)"}`).join(", ") || "ninguna";
    const parcial =
      `Alcancé el límite de pasos para este turno. Herramientas ejecutadas: ${hechas}. ` +
      "Dime si quieres que continúe con lo que falta.";
    sesion.mensajes.push({ role: "assistant", content: parcial });
    return cerrar("assistant", parcial, vistas, false);
  }
}
