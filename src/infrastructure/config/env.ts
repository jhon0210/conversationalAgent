export interface Entorno {
  fechaEjecucion?: string;
  diasAvisoVencimiento: number;
  zonaHoraria: string;
  maxIteraciones: number;
  maxTokensSesion: number;
  llmTimeoutMs: number;
  puerto: number;
  anthropicApiKey?: string;
  llmModel?: string;
  llmProvider: "anthropic" | "openai" | "mock";
  llmBaseUrl?: string;
  llmApiKey?: string;
}

const entero = (valor: string | undefined, porDefecto: number): number => {
  const n = Number.parseInt(valor ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

export const leerEntorno = (env: NodeJS.ProcessEnv = process.env): Entorno => {
  const fecha = env.FECHA_EJECUCION?.trim();
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error("FECHA_EJECUCION debe tener formato YYYY-MM-DD");
  }
  return {
    fechaEjecucion: fecha || undefined,
    diasAvisoVencimiento: entero(env.DIAS_AVISO_VENCIMIENTO, 30),
    zonaHoraria: env.ZONA_HORARIA?.trim() || "America/Bogota",
    maxIteraciones: entero(env.MAX_ITERACIONES, 25),
    maxTokensSesion: entero(env.MAX_TOKENS_SESION, 150_000),
    llmTimeoutMs: entero(env.LLM_TIMEOUT_MS, 60_000),
    puerto: entero(env.PORT, 3000),
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    llmModel: env.LLM_MODEL || undefined,
    llmProvider: env.LLM_PROVIDER === "mock" ? "mock" : env.LLM_PROVIDER === "openai" ? "openai" : "anthropic",
    llmBaseUrl: env.LLM_BASE_URL?.trim() || undefined,
    llmApiKey: env.LLM_API_KEY?.trim() || undefined,
  };
};
