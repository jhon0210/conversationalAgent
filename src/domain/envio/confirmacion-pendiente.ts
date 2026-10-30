// RN4: la confirmación solo vale si se pidió en un turno anterior al actual.
// Evita que el modelo se confirme a sí mismo dentro del mismo turno.
export const confirmacionValida = (turnoArmado: number | undefined, turnoActual: number): boolean =>
  turnoArmado !== undefined && turnoActual > turnoArmado;
