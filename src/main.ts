import "reflect-metadata";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { leerEntorno, type Entorno } from "./infrastructure/config/env";
import { FiltroErrores } from "./presentation/http/filtro-errores";

// Avisos en el log del servidor (sin mostrar claves) ante configuraciones incoherentes del LLM.
function advertirConfiguracionLlm(e: Entorno): void {
  if (e.llmProvider === "anthropic" && !e.anthropicApiKey) {
    const pista = e.llmApiKey
      ? " Hay un LLM_API_KEY definido: para Gemini u otra API compatible con OpenAI usa LLM_PROVIDER=openai y LLM_BASE_URL."
      : "";
    console.warn(`[config] LLM_PROVIDER=anthropic pero falta ANTHROPIC_API_KEY.${pista}`);
  }
  if (e.llmProvider === "openai") {
    const faltan = [!e.llmBaseUrl && "LLM_BASE_URL", !e.llmModel && "LLM_MODEL", !e.llmApiKey && "LLM_API_KEY"].filter(Boolean);
    if (faltan.length) console.warn(`[config] LLM_PROVIDER=openai pero falta: ${faltan.join(", ")}.`);
  }
}

async function arrancar(): Promise<void> {
  // En local se lee .env; en producción las variables vienen del entorno del servicio.
  const archivoEnv = path.join(process.cwd(), ".env");
  if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);
  const entorno = leerEntorno();
  advertirConfiguracionLlm(entorno);
  rmSync(path.join(process.cwd(), "out"), { recursive: true, force: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ["error", "warn", "log"] });
  app.set("trust proxy", 1);
  app.useGlobalFilters(new FiltroErrores());
  app.useStaticAssets(path.join(process.cwd(), "src", "presentation", "web"));
  await app.listen(entorno.puerto, "0.0.0.0");
  console.log(`Agente de registro como proveedor en http://localhost:${entorno.puerto} (LLM: ${entorno.llmProvider})`);
}

arrancar().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error instanceof Error ? error.message : error);
  process.exit(1);
});
