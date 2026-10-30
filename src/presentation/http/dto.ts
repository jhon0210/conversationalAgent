import { z } from "zod";

export const chatBodySchema = z.object({
  sessionId: z.string({ error: "Falta el sessionId" }).regex(/^[A-Za-z0-9_-]{1,64}$/, "sessionId inválido"),
  message: z.string({ error: "Falta el mensaje" }).min(1, "El mensaje está vacío"),
});

export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
