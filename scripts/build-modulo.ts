/**
 * Genera (o verifica) el módulo reutilizable a partir de las MISMAS fuentes que usa la aplicación:
 *   modulo/agent.md                          ← agent/prompt.md
 *   modulo/skill/registro-proveedor/SKILL.md ← src/infrastructure/knowledge/registro-proveedor.md
 *   modulo/tools/proveedor.ts                ← re-exporta src/tools/proveedor.ts (sin copia)
 *
 * Uso:  npm run modulo         (regenera)
 *       npm run modulo:check   (falla si el módulo no coincide con las fuentes)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const modo = process.argv.includes("--check") ? "check" : "build";

const leer = (...partes: string[]): string => readFileSync(path.join(raiz, ...partes), "utf8").replace(/\r\n/g, "\n").trim();

const prompt = leer("agent", "prompt.md");
const conocimiento = leer("src", "infrastructure", "knowledge", "registro-proveedor.md");

const agentMd = `---
description: Agente que prepara el registro de Periferia como proveedor ante clientes (lee la solicitud, llena el formulario desde el repositorio maestro, arma el paquete para firma). Nunca firma ni envía.
mode: primary
permission:
  edit: deny
  bash: deny
---

${prompt}
`;

const skillMd = `---
name: registro-proveedor
description: Conocimiento del proceso de registro como proveedor de Periferia IT Group: formatos de salida (xlsx, pdf, portal), estados de un campo, identificador tributario por país, soportes y reglas del paquete para firma.
---

${conocimiento}
`;

const herramientasTs = `// Mismas herramientas que usa la aplicación (cada export se expone como proveedor_<export>).
// No dependen del servidor HTTP: solo de las capas domain, application e infrastructure.
export * from "../../src/tools/proveedor";
`;

const archivos: [string, string][] = [
  [path.join("modulo", "agent.md"), agentMd],
  [path.join("modulo", "skill", "registro-proveedor", "SKILL.md"), skillMd],
  [path.join("modulo", "tools", "proveedor.ts"), herramientasTs],
];

let desfasados = 0;
for (const [relativa, contenido] of archivos) {
  const destino = path.join(raiz, relativa);
  const actual = existsSync(destino) ? readFileSync(destino, "utf8").replace(/\r\n/g, "\n") : undefined;
  if (modo === "check") {
    if (actual !== contenido) {
      desfasados++;
      console.log(`✗ ${relativa} no coincide con las fuentes`);
    } else {
      console.log(`✓ ${relativa}`);
    }
  } else {
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, contenido, "utf8");
    console.log(`Generado ${relativa}`);
  }
}

if (modo === "check" && desfasados > 0) {
  console.log("Ejecuta `npm run modulo` para regenerar el módulo.");
  process.exitCode = 1;
}
