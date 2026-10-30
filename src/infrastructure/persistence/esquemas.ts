import { z } from "zod";

export const solicitudSchema = z.object({
  id: z.string(),
  de: z.string(),
  asunto: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pais: z.enum(["CO", "EC", "PE", "PA", "HN"]),
  cliente: z.string(),
  cuerpo: z.string(),
  formato: z.enum(["xlsx", "pdf", "portal"]),
  adjuntos: z.array(z.string()).default([]),
});

export const plantillaCeldasSchema = z.array(
  z.object({
    hoja: z.string(),
    celda_etiqueta: z.string(),
    etiqueta: z.string(),
    celda_valor: z.string(),
  }),
);

export const plantillaCamposSchema = z.array(
  z.object({ etiqueta: z.string(), obligatorio: z.boolean().default(false) }),
);

export const soportesExigidosSchema = z.array(z.string());

export const glosarioSchema = z.record(z.string(), z.string());

export const maestroSchema = z.record(z.string(), z.unknown());

export const indiceSoportesSchema = z.array(
  z.object({
    tipo: z.string(),
    archivo: z.string(),
    vigencia_hasta: z.string().nullable(),
    pais_emisor: z.string(),
    descripcion: z.string(),
  }),
);
