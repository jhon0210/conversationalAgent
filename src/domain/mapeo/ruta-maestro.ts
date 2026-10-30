export type Maestro = Record<string, unknown>;

export const valorPorRuta = (maestro: Maestro, ruta: string): unknown => {
  let actual: unknown = maestro;
  for (const parte of ruta.split(".")) {
    if (actual === null || typeof actual !== "object") return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
};

export const tieneValor = (valor: unknown): boolean =>
  valor !== undefined && valor !== null && valor !== "";

// El número de cuenta nunca se muestra completo hacia el modelo ni el chat.
export const enmascararSiSensible = (ruta: string, valor: unknown): unknown => {
  if (ruta === "banco.numero_cuenta" && typeof valor === "string") {
    return `****${valor.slice(-4)}`;
  }
  return valor;
};
