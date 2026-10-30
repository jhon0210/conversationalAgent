import { Controller, Get, Inject } from "@nestjs/common";
import type { LlmProvider } from "../../../application/ports/llm";
import { TOKENS } from "../../../infrastructure/config/tokens";

@Controller("api/health")
export class HealthController {
  constructor(@Inject(TOKENS.LLM) private readonly llm: LlmProvider) {}

  @Get()
  salud() {
    // Nunca expone claves: solo si el proveedor está configurado.
    return { ok: true, provider: this.llm.nombre, model: this.llm.modelo, llmConfigurado: this.llm.configurado };
  }
}
