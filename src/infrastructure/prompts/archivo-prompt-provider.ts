import { promises as fs } from "node:fs";
import path from "node:path";
import type { PromptProvider } from "../../application/ports/agente";

// Comportamiento = agent/prompt.md; conocimiento = knowledge/registro-proveedor.md.
export class ArchivoPromptProvider implements PromptProvider {
  constructor(private readonly directory: string) {}

  async cargar(): Promise<string> {
    const prompt = await fs.readFile(path.join(this.directory, "agent", "prompt.md"), "utf8");
    const conocimiento = await fs.readFile(
      path.join(this.directory, "src", "infrastructure", "knowledge", "registro-proveedor.md"),
      "utf8",
    );
    return `${prompt.trim()}\n\n<knowledge>\n${conocimiento.trim()}\n</knowledge>`;
  }
}
