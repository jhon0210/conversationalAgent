import type { CodigoPais } from "../solicitud/solicitud";
import { UMBRAL_CONFIANZA, UMBRAL_PROPUESTA, type CampoMapeado } from "./estado-campo";
import { resolverEtiqueta, type Glosario } from "./glosario-resolver";
import { aplicarReglaIdentificador } from "./regla-identificador-pais";
import { tieneValor, valorPorRuta, type Maestro } from "./ruta-maestro";

export interface ContextoClasificacion {
  glosario: Glosario;
  maestro: Maestro;
  pais: CodigoPais;
}

const faltante = (etiqueta: string, nota: string): CampoMapeado => ({
  etiqueta,
  estado: "faltante",
  confianza: 0,
  nota,
});

export const clasificarCampo = (etiqueta: string, ctx: ContextoClasificacion): CampoMapeado => {
  const resolucion = resolverEtiqueta(etiqueta, ctx.glosario);
  if (!resolucion || resolucion.confianza < UMBRAL_PROPUESTA) {
    return faltante(etiqueta, "Sin equivalente en el glosario ni en el maestro");
  }
  if (!tieneValor(valorPorRuta(ctx.maestro, resolucion.ruta))) {
    return faltante(etiqueta, `El maestro no tiene valor en ${resolucion.ruta}`);
  }

  const base: CampoMapeado = {
    etiqueta,
    estado: resolucion.confianza >= UMBRAL_CONFIANZA ? "lleno" : "requiere_confirmacion",
    rutaMaestro: resolucion.ruta,
    confianza: Number(resolucion.confianza.toFixed(2)),
  };
  if (base.estado === "requiere_confirmacion") {
    base.nota = `Coincidencia aproximada con "${resolucion.etiquetaGlosario}"`;
  }
  return aplicarReglaIdentificador(base, ctx.pais);
};
