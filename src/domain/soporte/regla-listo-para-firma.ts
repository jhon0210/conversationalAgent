import type { SoporteEvaluado } from "./soporte";

// RN3: un soporte vencido o ausente bloquea. Los campos faltantes NO bloquean.
export const bloqueosDeFirma = (soportes: SoporteEvaluado[]): string[] =>
  soportes
    .filter((s) => s.estado !== "presente")
    .map((s) => `${s.tipo}: ${s.estado}${s.nota ? ` (${s.nota})` : ""}`);

export const listoParaFirma = (soportes: SoporteEvaluado[]): boolean =>
  bloqueosDeFirma(soportes).length === 0;
