import type { CeldaReporte, ColumnaReporte, FilaReporte, ReporteDetalle } from "./report-details";
export type ContextoExportacion = {
  empresa: string;
  periodo: string;
  canal: string;
  consultado: string;
  moneda: string;
};
export function celdaCSV(value: CeldaReporte) {
  if (value === null) return '""';
  let s = String(value);
  // Spreadsheet applications must not interpret imported names as formulas.
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function generarCSV(
  reporte: ReporteDetalle,
  filas: FilaReporte[],
  contexto: ContextoExportacion,
) {
  const rows: CeldaReporte[][] = [
    [reporte.titulo],
    [contexto.empresa],
    ["Período", contexto.periodo],
    ["Canal", contexto.canal],
    ["Consultado", contexto.consultado],
    ["Moneda", contexto.moneda],
    ["Criterio", reporte.nota],
    [],
    reporte.columnas.map((c) => c.titulo),
    ...filas.map((f) => reporte.columnas.map((c) => f[c.key] ?? null)),
  ];
  return "\uFEFF" + rows.map((row) => row.map(celdaCSV).join(";")).join("\r\n");
}
export function formatearCelda(value: CeldaReporte, columna: ColumnaReporte, moneda = "PEN") {
  if (value === null) return "Sin dato";
  if (typeof value !== "number") return value;
  if (columna.formato === "dinero")
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(value);
  if (columna.formato === "porcentaje") return value.toFixed(1) + "%";
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 4 }).format(value);
}
const nombre = (titulo: string) =>
  "bimbo-" +
  titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") +
  "-" +
  new Date().toISOString().slice(0, 10);
export function descargarCSV(
  reporte: ReporteDetalle,
  filas: FilaReporte[],
  contexto: ContextoExportacion,
) {
  const url = URL.createObjectURL(
    new Blob([generarCSV(reporte, filas, contexto)], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre(reporte.titulo) + ".csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function crearPDF(
  reporte: ReporteDetalle,
  filas: FilaReporte[],
  contexto: ContextoExportacion,
  comentario: { texto: string; generadoEn: string },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight(),
    margin = 12;
  const colWidth = (width - margin * 2) / reporte.columnas.length,
    lineHeight = 3.8;
  let y = margin;
  const clean = (s: string) =>
    s
      .replace(/[\u00a0\u202f]/g, " ")
      .replace(/\u2013|\u2014/g, "-")
      .replace(/→/g, ">");
  const paragraph = (s: string, size = 9) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(s), width - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.3 + 2;
  };
  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(32, 52, 78);
    paragraph(reporte.titulo, 16);
    doc.setFont("helvetica", "normal");
    paragraph(contexto.empresa, 10);
    paragraph(
      `Período: ${contexto.periodo} | Canal: ${contexto.canal} | Moneda: ${contexto.moneda}`,
    );
    paragraph(`Consulta de Dolibarr: ${contexto.consultado} | Registros: ${filas.length}`);
    paragraph(reporte.nota, 8);
    y += 2;
  };
  const tableHeader = () => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const cells = reporte.columnas.map(
      (c) => doc.splitTextToSize(clean(c.titulo), colWidth - 4) as string[],
    );
    const h = Math.max(...cells.map((c) => c.length)) * lineHeight + 5;
    doc.setFillColor(232, 238, 246);
    doc.rect(margin, y, width - margin * 2, h, "F");
    doc.setTextColor(32, 52, 78);
    cells.forEach((lines, i) => doc.text(lines, margin + i * colWidth + 2, y + 4));
    y += h;
    doc.setFont("helvetica", "normal");
  };
  header();
  tableHeader();
  filas.forEach((fila, index) => {
    doc.setFontSize(8);
    const cells = reporte.columnas.map(
      (c) =>
        doc.splitTextToSize(
          clean(formatearCelda(fila[c.key] ?? null, c, contexto.moneda)),
          colWidth - 4,
        ) as string[],
    );
    const h = Math.max(...cells.map((c) => c.length)) * lineHeight + 5;
    if (y + h > height - 16) {
      doc.addPage();
      y = margin;
      doc.setFontSize(10);
      doc.text(clean(reporte.titulo + " (continuación)"), margin, y);
      y += 7;
      tableHeader();
    }
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 252);
      doc.rect(margin, y, width - margin * 2, h, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    cells.forEach((lines, i) => doc.text(lines, margin + i * colWidth + 2, y + 4));
    y += h;
  });
  // Dedicated explanation page keeps the complete text readable, even for long exports.
  doc.addPage();
  y = margin;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(32, 52, 78);
  paragraph("Comentario de la IA", 16);
  doc.setFont("helvetica", "normal");
  paragraph(reporte.titulo, 11);
  paragraph(
    `Alcance: ${filas.length} registros filtrados. ${contexto.periodo}. Canal: ${contexto.canal}.`,
    9,
  );
  paragraph(
    `Generado: ${new Date(comentario.generadoEn).toLocaleString("es-PE", { timeZone: "America/Lima" })} (Lima)`,
    8,
  );
  y += 5;
  doc.setFontSize(11);
  const explanationLines = doc.splitTextToSize(
    clean(comentario.texto),
    width - margin * 2,
  ) as string[];
  for (const line of explanationLines) {
    if (y > height - 20) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 5.5;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, width - margin, height - 8, { align: "right" });
  }
  return doc;
}

export async function descargarPDF(
  reporte: ReporteDetalle,
  filas: FilaReporte[],
  contexto: ContextoExportacion,
  comentario: { texto: string; generadoEn: string },
) {
  const doc = await crearPDF(reporte, filas, contexto, comentario);
  doc.save(nombre(reporte.titulo) + ".pdf");
}
