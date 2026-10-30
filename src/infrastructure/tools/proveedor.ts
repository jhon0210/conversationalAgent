import { z } from "zod";
import { definirHerramienta } from "./tool-runtime";

const caso = z.string().min(1).describe("Nombre de la carpeta del caso en fixtures/reto-01/casos/");

const entradaMapeo = z.object({
  etiqueta: z.string().describe("Etiqueta del campo"),
  estado: z.enum(["lleno", "faltante", "requiere_confirmacion"]).describe("Estado devuelto por proveedor_mapear_campos"),
  ruta_maestro: z.string().nullish().describe("Ruta del dato en el maestro, si existe"),
});

export const leer_solicitud = definirHerramienta({
  nombre: "proveedor_leer_solicitud",
  description:
    "Lee la solicitud del cliente y devuelve país, cliente, formato (xlsx|pdf|portal), campos solicitados y soportes exigidos.",
  args: { caso },
  async run({ caso }, c) {
    const data = await c.leerSolicitud.ejecutar(caso);
    return { data, resumen: `${data.formato} · ${data.pais} · ${data.campos.length} campos · ${data.soportes.length} soportes` };
  },
});

export const mapear_campos = definirHerramienta({
  nombre: "proveedor_mapear_campos",
  description:
    "Cruza cada campo solicitado con el repositorio maestro y los clasifica en llenos, faltantes y requiere_confirmacion.",
  args: {
    caso,
    campos: z.array(z.string()).min(1).describe("Etiquetas de los campos devueltas por proveedor_leer_solicitud"),
  },
  async run(args, c) {
    const data = await c.mapearCampos.ejecutar(args);
    return {
      data,
      resumen: `${data.llenos.length} llenos · ${data.faltantes.length} faltantes · ${data.requiere_confirmacion.length} por confirmar`,
    };
  },
});

export const generar_formulario = definirHerramienta({
  nombre: "proveedor_generar_formulario",
  description:
    "Genera el formulario en el formato del cliente (xlsx, pdf o valores-portal.md); los valores se leen del maestro, no del mapeo recibido.",
  args: {
    caso,
    mapeo: z
      .union([z.array(entradaMapeo), z.object({ todos: z.array(entradaMapeo) })])
      .describe("Mapeo devuelto por proveedor_mapear_campos (el arreglo `todos`), sin modificar"),
  },
  async run(args, c) {
    const data = await c.generarFormulario.ejecutar(args);
    return { data, resumen: `${data.formato} → ${data.ruta}` };
  },
});

export const armar_paquete = definirHerramienta({
  nombre: "proveedor_armar_paquete",
  description:
    "Arma el paquete para firma (formulario, soportes, checklist y borrador de correo) y devuelve fecha_ejecucion y listo_para_firma.",
  args: { caso },
  async run({ caso }, c, ctx) {
    const data = await c.armarPaquete.ejecutar({ caso }, ctx.sessionId);
    return { data, resumen: `listo_para_firma=${data.listo_para_firma} · fecha_ejecucion=${data.fecha_ejecucion}` };
  },
});

export const simular_envio = definirHerramienta({
  nombre: "proveedor_simular_envio",
  description:
    "Simula el envío escribiendo ENVIO-SIMULADO.md; solo procede con confirmación explícita del usuario en un mensaje posterior.",
  args: {
    caso,
    confirmado: z.boolean().describe("true solo si el usuario confirmó explícitamente en su último mensaje"),
  },
  async run(args, c, ctx) {
    const data = await c.simularEnvio.ejecutar(args, ctx.sessionId);
    return { data, resumen: `simulado → ${data.ruta}` };
  },
});
