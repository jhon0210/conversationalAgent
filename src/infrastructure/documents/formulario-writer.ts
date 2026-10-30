import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { FilaFormulario, FormularioWriter, ValorFormulario } from "../../application/ports/salida";
import { resolverRelativaEnSalida, type Rutas } from "../persistence/rutas";

const textoValor = (valor: ValorFormulario): string => (valor === null ? "" : String(valor));

const ETIQUETA_ESTADO = {
  lleno: "lleno",
  faltante: "FALTANTE",
  requiere_confirmacion: "REQUIERE CONFIRMACIÓN",
} as const;

export class DocumentosFormularioWriter implements FormularioWriter {
  constructor(private readonly rutas: Rutas) {}

  private async preparar(destino: string): Promise<string> {
    const ruta = resolverRelativaEnSalida(this.rutas.salida, destino);
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    return ruta;
  }

  async escribirXlsx(destino: string, filas: FilaFormulario[]): Promise<void> {
    const ruta = await this.preparar(destino);
    const libro = new ExcelJS.Workbook();
    const hojas = new Map<string, ExcelJS.Worksheet>();

    for (const fila of filas) {
      const nombreHoja = fila.hoja ?? "Hoja1";
      let hoja = hojas.get(nombreHoja);
      if (!hoja) {
        hoja = libro.addWorksheet(nombreHoja);
        hojas.set(nombreHoja, hoja);
      }
      hoja.getCell(fila.celdaEtiqueta ?? "A1").value = fila.etiqueta;
      const celda = hoja.getCell(fila.celdaValor ?? "B1");
      celda.value = fila.valor;
      if (fila.estado === "requiere_confirmacion" && fila.nota) celda.note = fila.nota;
    }
    for (const hoja of hojas.values()) hoja.columns.forEach((c) => (c.width = 38));
    await libro.xlsx.writeFile(ruta);
  }

  async escribirPdf(destino: string, titulo: string, filas: FilaFormulario[]): Promise<void> {
    const ruta = await this.preparar(destino);
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const flujo = doc.pipe(createWriteStream(ruta));
      flujo.on("finish", () => resolve());
      flujo.on("error", reject);

      doc.fontSize(16).text(titulo, { underline: true }).moveDown();
      for (const fila of filas) {
        const marca = fila.obligatorio ? " *" : "";
        doc.fontSize(10).fillColor("#555555").text(`${fila.etiqueta}${marca}`);
        doc.fontSize(12).fillColor("#000000").text(textoValor(fila.valor) || "________________");
        if (fila.estado !== "lleno") {
          doc.fontSize(8).fillColor("#B45309").text(`${ETIQUETA_ESTADO[fila.estado]}${fila.nota ? `: ${fila.nota}` : ""}`);
        }
        doc.moveDown(0.6);
      }
      doc.fillColor("#555555").fontSize(8).text("* Campo obligatorio. Documento preparado para firma del representante legal.");
      doc.end();
    });
  }

  async escribirPortal(destino: string, titulo: string, filas: FilaFormulario[]): Promise<void> {
    const ruta = await this.preparar(destino);
    const celda = (t: string): string => t.replace(/\|/g, "\\|");
    const lineas = [
      `# ${titulo}`,
      "",
      "> Formato no soportado: portal web. Valores listos para copiar. El ingreso de credenciales y el clic en \"Enviar\" los realiza una persona.",
      "",
      "| Campo | Valor | Estado | Nota |",
      "|---|---|---|---|",
      ...filas.map(
        (f) => `| ${celda(f.etiqueta)} | ${celda(textoValor(f.valor))} | ${ETIQUETA_ESTADO[f.estado]} | ${celda(f.nota ?? "")} |`,
      ),
      "",
    ];
    await fs.writeFile(ruta, lineas.join("\n"), "utf8");
  }
}
