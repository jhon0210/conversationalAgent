export type Glosario = Record<string, string>;

export interface Resolucion {
  ruta: string;
  etiquetaGlosario: string;
  confianza: number;
}

export const normalizar = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const bigramas = (texto: string): string[] => {
  const resultado: string[] = [];
  for (let i = 0; i < texto.length - 1; i++) resultado.push(texto.slice(i, i + 2));
  return resultado;
};

// Coeficiente de Dice sobre bigramas: 1 = idéntico, 0 = sin nada en común.
export const similitud = (a: string, b: string): number => {
  const x = normalizar(a);
  const y = normalizar(b);
  if (x === y) return 1;
  const bx = bigramas(x);
  const by = bigramas(y);
  if (bx.length === 0 || by.length === 0) return 0;
  const conteo = new Map<string, number>();
  for (const g of bx) conteo.set(g, (conteo.get(g) ?? 0) + 1);
  let comunes = 0;
  for (const g of by) {
    const n = conteo.get(g) ?? 0;
    if (n > 0) {
      comunes++;
      conteo.set(g, n - 1);
    }
  }
  return (2 * comunes) / (bx.length + by.length);
};

export const resolverEtiqueta = (etiqueta: string, glosario: Glosario): Resolucion | null => {
  let mejor: Resolucion | null = null;
  for (const [etiquetaGlosario, ruta] of Object.entries(glosario)) {
    const confianza = similitud(etiqueta, etiquetaGlosario);
    if (!mejor || confianza > mejor.confianza) mejor = { ruta, etiquetaGlosario, confianza };
  }
  return mejor;
};
