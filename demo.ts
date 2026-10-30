/**
 * Verificación sin modelo: ejecuta las herramientas de src/tools/proveedor.ts
 * sobre todos los casos de fixtures/reto-01/casos/ y comprueba invariantes del PRD.
 * Uso: npm run demo   (opcional: FECHA_EJECUCION=2026-09-03 para fijar la fecha)
 */
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { obtenerContenedor } from "./src/infrastructure/config/container";
import * as proveedor from "./src/tools/proveedor";

interface Respuesta {
  ok: boolean;
  data?: any;
  error?: string;
}

const directory = process.cwd();
const salida = path.join(directory, "out");
let fallos = 0;
let comprobaciones = 0;

const comprobar = (condicion: boolean, descripcion: string): void => {
  comprobaciones++;
  if (!condicion) {
    fallos++;
    console.log(`   ✗ ${descripcion}`);
  }
};

const llamar = async (
  herramienta: { execute: (args: any, ctx: { directory: string; sessionId: string }) => Promise<string> },
  args: unknown,
  sessionId: string,
): Promise<Respuesta> => JSON.parse(await herramienta.execute(args, { directory, sessionId }));

const leerSalida = (...partes: string[]): string => readFileSync(path.join(salida, ...partes), "utf8");

const maestro = JSON.parse(readFileSync(path.join(directory, "fixtures/reto-01/repositorio/maestro.json"), "utf8"));
const datosBancarios = [maestro.banco.nombre, maestro.banco.numero_cuenta, maestro.banco.swift];

const LISTO_ESPERADO_2026_09_03: Record<string, boolean> = {
  "co-industrias-delta": true,
  "ec-corp-andina": false,
  "hn-agroexport-sula": false,
  "pa-logistica-istmo": true,
};

async function procesarCaso(caso: string): Promise<void> {
  const sid = `demo-${caso}`;
  const sol = await llamar(proveedor.leer_solicitud, { caso }, sid);
  if (!sol.ok) {
    console.log(`${caso}: ERROR ${sol.error}`);
    fallos++;
    return;
  }
  const { pais, formato, campos, soportes } = sol.data;
  const mapeo = await llamar(proveedor.mapear_campos, { caso, campos }, sid);
  const form = await llamar(proveedor.generar_formulario, { caso, mapeo: mapeo.data.todos }, sid);
  const paquete = await llamar(proveedor.armar_paquete, { caso }, sid);

  comprobar(mapeo.ok && form.ok && paquete.ok, `${caso}: todas las herramientas responden ok`);
  const { llenos, faltantes, requiere_confirmacion } = mapeo.data;
  const etiquetas = (lista: { etiqueta: string }[]): string[] => lista.map((x) => x.etiqueta);

  console.log(`\n■ ${caso} [${pais} · ${formato}]`);
  console.log(`  campos: ${llenos.length} llenos · ${faltantes.length} faltantes · ${requiere_confirmacion.length} por confirmar`);
  if (faltantes.length) console.log(`  faltantes: ${etiquetas(faltantes).join(", ")}`);
  if (requiere_confirmacion.length) {
    for (const r of requiere_confirmacion) console.log(`  confirmar: ${r.etiqueta} → ${r.motivo}`);
  }
  console.log(`  soportes exigidos: ${soportes.join(", ")}`);
  const estados = paquete.data.checklist.soportes.map(
    (s: { tipo: string; estado: string; aviso?: string }) => `${s.tipo}=${s.estado}${s.aviso ? "(vence pronto)" : ""}`,
  );
  console.log(`  soportes: ${estados.join(" · ")}`);
  console.log(`  fecha_ejecucion=${paquete.data.fecha_ejecucion} listo_para_firma=${paquete.data.listo_para_firma}`);
  if (paquete.data.checklist.bloqueos.length) console.log(`  bloqueos: ${paquete.data.checklist.bloqueos.join("; ")}`);
  console.log(`  formulario: ${form.data.ruta}${form.data.aviso ? `  (${form.data.aviso})` : ""}`);

  // Invariantes comunes
  comprobar(form.data.discrepancias_mapeo === 0, `${caso}: el mapeo enviado coincide con el calculado`);
  comprobar(existsSync(path.join(salida, caso, "log.jsonl")), `${caso}: existe out/<caso>/log.jsonl`);
  for (const archivo of ["checklist.md", "borrador-correo.md"]) {
    comprobar(existsSync(path.join(salida, caso, "paquete", archivo)), `${caso}: paquete/${archivo}`);
  }
  const borrador = leerSalida(caso, "paquete", "borrador-correo.md");
  comprobar(datosBancarios.every((d) => !borrador.includes(d)), `${caso}: RN2 sin datos bancarios en el borrador`);
  const checklist = leerSalida(caso, "paquete", "checklist.md");
  comprobar(datosBancarios.every((d) => !checklist.includes(d)), `${caso}: sin datos bancarios en el checklist`);
  const listoEsperado = LISTO_ESPERADO_2026_09_03[caso];
  if (paquete.data.fecha_ejecucion === "2026-09-03" && listoEsperado !== undefined) {
    comprobar(paquete.data.listo_para_firma === listoEsperado, `${caso}: listo_para_firma esperado (${listoEsperado}) a 2026-09-03`);
  }
  const ausentes = paquete.data.checklist.soportes.filter((s: { estado: string }) => s.estado === "ausente");
  comprobar(
    paquete.data.listo_para_firma === (paquete.data.checklist.bloqueos.length === 0),
    `${caso}: listo_para_firma consistente con los bloqueos`,
  );

  // Invariantes por caso
  if (caso === "co-industrias-delta") {
    comprobar(faltantes.length === 0, "delta: sin campos faltantes");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(path.join(salida, caso, "formulario.xlsx"));
    comprobar(libro.getWorksheet("Datos Proveedor")?.getCell("C3").value === maestro.razon_social, "delta: Razón social en Datos Proveedor!C3");
    comprobar(libro.getWorksheet("Datos Proveedor")?.getCell("B3").value === "Razón social", "delta: etiqueta en Datos Proveedor!B3");
    comprobar(libro.getWorksheet("Datos Bancarios")?.getCell("C5").value === maestro.banco.numero_cuenta, "delta: cuenta en Datos Bancarios!C5");
    comprobar(libro.getWorksheet("Datos Proveedor")?.getCell("C4").value === maestro.nit, "delta: NIT lleno en CO");
  }
  if (caso === "ec-corp-andina") {
    comprobar(etiquetas(faltantes).includes("Número de contribuyente especial"), "ec: contribuyente especial es faltante");
    comprobar(etiquetas(requiere_confirmacion).includes("RUC"), "ec: RUC requiere confirmación");
    comprobar(
      requiere_confirmacion.some((r: { motivo: string }) => r.motivo.includes("identificador extranjero")),
      "ec: nota 'identificador extranjero'",
    );
    comprobar(ausentes.some((s: { tipo: string }) => s.tipo === "certificado_cumplimiento_tributario"), "ec: cumplimiento tributario ausente");
    comprobar(paquete.data.listo_para_firma === false, "ec: bloqueado por soporte ausente");
    comprobar(existsSync(path.join(salida, caso, "formulario.pdf")), "ec: formulario.pdf generado");
  }
  if (caso === "hn-agroexport-sula") {
    comprobar(etiquetas(faltantes).includes("Referencias comerciales"), "hn: referencias comerciales es faltante");
    comprobar(etiquetas(requiere_confirmacion).includes("RTN"), "hn: RTN requiere confirmación");
    comprobar(llenos.every((l: { ruta_maestro: string }) => !l.ruta_maestro.startsWith("banco")), "hn: no pide ni llena datos bancarios");
    comprobar(existsSync(path.join(salida, caso, "formulario.xlsx")), "hn: formulario.xlsx generado");
  }
  if (caso === "pa-logistica-istmo") {
    comprobar(form.data.formato === "portal", "pa: formato portal");
    comprobar(String(form.data.aviso).includes("formato no soportado"), "pa: aviso 'formato no soportado'");
    comprobar(existsSync(path.join(salida, caso, "valores-portal.md")), "pa: valores-portal.md generado");
    comprobar(!existsSync(path.join(salida, caso, "formulario.pdf")) && !existsSync(path.join(salida, caso, "formulario.xlsx")), "pa: no genera pdf ni xlsx");
    comprobar(!/contrase|password|usuario/i.test(leerSalida(caso, "valores-portal.md")), "pa: sin credenciales en valores-portal.md");
  }

  // RN4: flujo de confirmación
  const confirmaciones = obtenerContenedor(directory).confirmaciones;
  const sinConfirmar = await llamar(proveedor.simular_envio, { caso, confirmado: false }, sid);
  comprobar(!sinConfirmar.ok && /requiere confirmación explícita/.test(sinConfirmar.error ?? ""), `${caso}: sin confirmar se rechaza`);
  const mismoTurno = await llamar(proveedor.simular_envio, { caso, confirmado: true }, sid);
  comprobar(!mismoTurno.ok, `${caso}: no se acepta confirmación en el mismo turno`);
  comprobar(!existsSync(path.join(salida, caso, "ENVIO-SIMULADO.md")), `${caso}: no hay ENVIO-SIMULADO.md antes de confirmar`);
  confirmaciones.avanzarTurno(sid);
  const confirmado = await llamar(proveedor.simular_envio, { caso, confirmado: true }, sid);
  comprobar(confirmado.ok && existsSync(path.join(salida, caso, "ENVIO-SIMULADO.md")), `${caso}: ENVIO-SIMULADO.md tras confirmar`);
  const repetido = await llamar(proveedor.simular_envio, { caso, confirmado: true }, sid);
  comprobar(!repetido.ok, `${caso}: la confirmación se consume (no se reutiliza)`);
  console.log(`  envío: ${confirmado.ok ? confirmado.data.ruta : confirmado.error} (simulado)`);
}

async function casosNegativos(): Promise<void> {
  console.log("\n■ Manejo de errores (HU-5)");
  const inexistente = await llamar(proveedor.leer_solicitud, { caso: "no-existe" }, "demo-err");
  comprobar(!inexistente.ok && !!inexistente.error && !inexistente.error.includes("at "), "caso inexistente: error claro sin traza");
  const traversal = await llamar(proveedor.leer_solicitud, { caso: "../../etc" }, "demo-err");
  comprobar(!traversal.ok, "path traversal rechazado");
  const argsMalos = await llamar(proveedor.mapear_campos, { caso: "co-industrias-delta" }, "demo-err");
  comprobar(!argsMalos.ok && /inválidos/.test(argsMalos.error ?? ""), "argumentos inválidos devuelven ok:false");
  const sinPaquete = await llamar(proveedor.simular_envio, { caso: "co-industrias-delta", confirmado: true }, "demo-nuevo");
  comprobar(!sinPaquete.ok, "simular_envio sin paquete ni confirmación previa se rechaza");
  console.log(`  caso inexistente → ${inexistente.error}`);
}

async function main(): Promise<void> {
  rmSync(salida, { recursive: true, force: true });
  const casos = readdirSync(path.join(directory, "fixtures/reto-01/casos"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  console.log(`Demo sin LLM · ${casos.length} casos · FECHA_EJECUCION=${process.env.FECHA_EJECUCION || "(fecha del sistema)"}`);
  for (const caso of casos) await procesarCaso(caso);
  await casosNegativos();

  console.log(`\n${comprobaciones - fallos}/${comprobaciones} comprobaciones OK`);
  if (fallos > 0) {
    console.log(`✗ ${fallos} comprobación(es) fallida(s)`);
    process.exitCode = 1;
  } else {
    console.log("✓ Demo completada sin fallos");
  }
}

main().catch((e) => {
  console.error("Fallo inesperado en la demo:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
