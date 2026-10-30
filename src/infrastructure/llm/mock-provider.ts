import type {
  DefinicionHerramienta,
  LlmProvider,
  OpcionesLlm,
  RespuestaLlm,
} from "../../application/ports/llm";
import type { Bloque, BloqueToolResult, BloqueToolUse, Mensaje } from "../../domain/conversacion/mensaje";

type Resultado = { ok: boolean; data?: Record<string, any>; error?: string };

const bloquesDe = (m: Mensaje | undefined): Bloque[] => (m && typeof m.content !== "string" ? m.content : []);

// Resultado JSON de la última llamada a una herramienta, buscando hacia atrás en la conversación.
const ultimoResultado = (mensajes: Mensaje[], herramienta: string): Resultado | undefined => {
  for (let i = mensajes.length - 1; i > 0; i--) {
    const usos = bloquesDe(mensajes[i - 1]).filter((b): b is BloqueToolUse => b.type === "tool_use" && b.name === herramienta);
    const res = bloquesDe(mensajes[i]).find(
      (b): b is BloqueToolResult => b.type === "tool_result" && usos.some((u) => u.id === b.tool_use_id),
    );
    if (res) return JSON.parse(res.content) as Resultado;
  }
  return undefined;
};

const ultimoCaso = (mensajes: Mensaje[]): string | undefined => {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const uso = bloquesDe(mensajes[i]).find((b): b is BloqueToolUse => b.type === "tool_use" && b.name === "proveedor_armar_paquete");
    if (uso) return String(uso.input.caso);
  }
  return undefined;
};

/**
 * Proveedor determinista para pruebas sin clave (LLM_PROVIDER=mock).
 * Sigue el flujo del prompt: leer → mapear → generar → armar → pregunta de confirmación.
 */
export class MockProvider implements LlmProvider {
  readonly nombre = "mock";
  readonly modelo = "guion-determinista";
  readonly configurado = true;
  private contador = 0;

  async enviar(mensajes: Mensaje[], _h: DefinicionHerramienta[], _o: OpcionesLlm): Promise<RespuestaLlm> {
    const latencia = Number(process.env.MOCK_LATENCIA_MS ?? 0);
    if (latencia > 0) await new Promise((r) => setTimeout(r, latencia));
    const ultimo = mensajes[mensajes.length - 1];
    const usage = { input: 1200, output: 150 };
    const llamar = (name: string, input: Record<string, unknown>): RespuestaLlm => {
      const uso: BloqueToolUse = { type: "tool_use", id: `mock_${++this.contador}`, name, input };
      return { texto: "", toolCalls: [uso], contenido: [uso], usage };
    };
    const decir = (texto: string): RespuestaLlm => ({ texto, toolCalls: [], contenido: [{ type: "text", text: texto }], usage });

    if (ultimo && typeof ultimo.content === "string") {
      const texto = ultimo.content;
      const caso = /([a-z]{2}-[a-z0-9-]+)/i.exec(texto)?.[1];
      if (/procesa/i.test(texto) && caso) return llamar("proveedor_leer_solicitud", { caso });
      if (/^\s*(s[ií]|confirmo|env[ií]a)/i.test(texto)) {
        const casoPendiente = ultimoCaso(mensajes);
        return casoPendiente
          ? llamar("proveedor_simular_envio", { caso: casoPendiente, confirmado: true })
          : decir("No hay ningún envío pendiente de confirmar.");
      }
      if (/^\s*no\b/i.test(texto)) return decir("Entendido, no simulo el envío. El paquete queda en out/ para tu revisión.");
      return decir("Puedo procesar un caso: escribe, por ejemplo, Procesa el caso \"ec-corp-andina\".");
    }

    const resultados = bloquesDe(ultimo).filter((b): b is BloqueToolResult => b.type === "tool_result");
    const ultimoUso = bloquesDe(mensajes[mensajes.length - 2]).find((b): b is BloqueToolUse => b.type === "tool_use");
    const res = resultados[0] ? (JSON.parse(resultados[0].content) as Resultado) : undefined;
    if (!res?.ok) return decir(`No pude completar el paso: ${res?.error ?? "error desconocido"}.`);
    const caso = String(ultimoUso?.input.caso ?? "");

    switch (ultimoUso?.name) {
      case "proveedor_leer_solicitud":
        return llamar("proveedor_mapear_campos", { caso, campos: res.data?.campos });
      case "proveedor_mapear_campos":
        return llamar("proveedor_generar_formulario", { caso, mapeo: res.data?.todos });
      case "proveedor_generar_formulario":
        return llamar("proveedor_armar_paquete", { caso });
      case "proveedor_armar_paquete": {
        const mapeo = ultimoResultado(mensajes, "proveedor_mapear_campos")?.data ?? {};
        const d = res.data ?? {};
        const bloqueos: string[] = d.checklist?.bloqueos ?? [];
        return decir(
          [
            `**Caso**: ${caso}`,
            `**Campos**: ${mapeo.llenos?.length ?? 0} llenos · ${mapeo.faltantes?.length ?? 0} faltantes · ${mapeo.requiere_confirmacion?.length ?? 0} por confirmar`,
            `**Estado**: listo_para_firma = ${d.listo_para_firma ? "sí" : "no"} (fecha de ejecución ${d.fecha_ejecucion})`,
            ...bloqueos.map((b) => `- Bloqueo: ${b}`),
            `**Archivos**: ${d.ruta}`,
            "",
            `CONFIRMACIÓN REQUERIDA: ¿Confirmas la simulación de envío del caso ${caso}? (sí / no)`,
          ].join("\n"),
        );
      }
      case "proveedor_simular_envio":
        return decir(`Listo: escribí ${res.data?.ruta}. Recuerda que es una simulación; no se envió nada real.`);
      default:
        return decir("Paso completado.");
    }
  }
}
