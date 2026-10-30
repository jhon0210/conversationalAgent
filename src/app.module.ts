import { Module } from "@nestjs/common";
import { EjecutarTurnoUseCase } from "./application/agente/ejecutar-turno.usecase";
import { ListarCasosUseCase } from "./application/solicitud/listar-casos.usecase";
import { obtenerContenedor } from "./infrastructure/config/container";
import { leerEntorno, type Entorno } from "./infrastructure/config/env";
import { TOKENS } from "./infrastructure/config/tokens";
import { AnthropicProvider } from "./infrastructure/llm/anthropic-provider";
import { MockProvider } from "./infrastructure/llm/mock-provider";
import { OpenAICompatibleProvider } from "./infrastructure/llm/openai-compatible-provider";
import { FsCasoRepo } from "./infrastructure/persistence/fs-caso-repo";
import { construirRutas } from "./infrastructure/persistence/rutas";
import { ArchivoPromptProvider } from "./infrastructure/prompts/archivo-prompt-provider";
import { MemoriaSessionStore } from "./infrastructure/sessions/memoria-session-store";
import { RegistroHerramientasProveedor } from "./infrastructure/tools/registro-herramientas";
import { ChatController } from "./presentation/http/controllers/chat.controller";
import { HealthController } from "./presentation/http/controllers/health.controller";
import { SessionsController } from "./presentation/http/controllers/sessions.controller";
import type { LlmProvider } from "./application/ports/llm";
import type { SessionStore } from "./application/ports/agente";

const directory = process.cwd();

// Raíz de composición: único lugar que conoce las implementaciones concretas.
@Module({
  controllers: [ChatController, SessionsController, HealthController],
  providers: [
    { provide: TOKENS.ENTORNO, useFactory: () => leerEntorno() },
    {
      provide: TOKENS.LLM,
      inject: [TOKENS.ENTORNO],
      useFactory: (env: Entorno): LlmProvider => {
        if (env.llmProvider === "mock") return new MockProvider();
        if (env.llmProvider === "openai") {
          return new OpenAICompatibleProvider(env.llmBaseUrl, env.llmApiKey, env.llmModel ?? "");
        }
        return new AnthropicProvider(env.anthropicApiKey, env.llmModel);
      },
    },
    { provide: TOKENS.SESIONES, useFactory: () => new MemoriaSessionStore() },
    {
      provide: TOKENS.LISTAR_CASOS,
      useFactory: () => new ListarCasosUseCase(new FsCasoRepo(construirRutas(directory))),
    },
    {
      provide: TOKENS.EJECUTAR_TURNO,
      inject: [TOKENS.ENTORNO, TOKENS.LLM, TOKENS.SESIONES],
      useFactory: (env: Entorno, llm: LlmProvider, sesiones: SessionStore) =>
        new EjecutarTurnoUseCase(
          llm,
          new RegistroHerramientasProveedor(),
          sesiones,
          new ArchivoPromptProvider(directory),
          obtenerContenedor(directory).confirmaciones,
          {
            maxIteraciones: env.maxIteraciones,
            maxTokensSesion: env.maxTokensSesion,
            llmTimeoutMs: env.llmTimeoutMs,
            maxLongitudMensaje: 4000,
            directory,
          },
        ),
    },
  ],
})
export class AppModule {}
