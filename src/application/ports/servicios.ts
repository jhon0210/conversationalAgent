export interface Clock {
  hoy(): string;
}

export interface EntradaAuditoria {
  caso?: string;
  herramienta: string;
  ok: boolean;
  resumen: string;
}

export interface AuditLog {
  registrar(entrada: EntradaAuditoria): Promise<void>;
}

export interface ConfirmacionStore {
  armar(sessionId: string, caso: string): void;
  avanzarTurno(sessionId: string): void;
  consumir(sessionId: string, caso: string): boolean;
}

export interface ReglasNegocio {
  diasAvisoVencimiento: number;
}
