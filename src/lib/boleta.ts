import { buscarProducto, cuenta, formatoMoneda, precioPorVolumen } from "@/data/catalogo";
import type { LineaPedido } from "@/context/pedido";

export type BoletaGuardada = {
  ordenId: string;
  nroOperacion: string;
  lineas: LineaPedido[];
  fecha: string;
  total: number;
};

const CLAVE_BOLETAS = "bimbo-boletas-v1";

export function leerBoletas(): BoletaGuardada[] {
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE_BOLETAS) ?? "[]") as BoletaGuardada[];
  } catch {
    return [];
  }
}

export function guardarBoleta(b: BoletaGuardada) {
  try {
    window.localStorage.setItem(CLAVE_BOLETAS, JSON.stringify([b, ...leerBoletas()]));
  } catch {
    return;
  }
}

export async function generarBoleta(datos: {
  ordenId: string;
  nroOperacion: string;
  lineas: LineaPedido[];
  fecha?: string;
}): Promise<{ blob: Blob; nombre: string }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const rojo: [number, number, number] = [218, 41, 28];
  const ancho = 210;
  const m = 15;

  doc.setFillColor(...rojo);
  doc.rect(0, 0, ancho, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Bimbo Osito", m, 17);
  doc.setFontSize(11);
  doc.text("BOLETA DE PAGO", ancho - m, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`N.° B001-${datos.ordenId.slice(-6)}`, ancho - m, 19, { align: "right" });

  const fecha = datos.fecha ? new Date(datos.fecha) : new Date();
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  let y = 40;
  const fila = (a: string, b: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(a, m, y);
    doc.setFont("helvetica", "normal");
    doc.text(b, m + 40, y);
    y += 6;
  };
  fila("Cliente:", `${cuenta.cliente} — ${cuenta.sucursal}`);
  fila("Fecha:", fecha.toLocaleString("es-PE"));
  fila("Orden:", datos.ordenId);
  fila("Medio de pago:", "Yape");
  fila("N.° operación:", datos.nroOperacion);

  y += 4;
  doc.setFillColor(240, 240, 245);
  doc.rect(m, y, ancho - 2 * m, 8, "F");
  doc.setFont("helvetica", "bold");
  const cols = [m + 2, m + 30, 130, 155, ancho - m - 2];
  doc.text("SKU", cols[0]!, y + 5.5);
  doc.text("Producto", cols[1]!, y + 5.5);
  doc.text("Planchas", cols[2]!, y + 5.5, { align: "right" });
  doc.text("P. unit.", cols[3]!, y + 5.5, { align: "right" });
  doc.text("Importe", cols[4]!, y + 5.5, { align: "right" });
  y += 14;
  doc.setFont("helvetica", "normal");

  let total = 0;
  for (const l of datos.lineas) {
    const p = buscarProducto(l.sku);
    if (!p) continue;
    const precio = precioPorVolumen(p, l.planchas);
    const imp = precio * l.planchas;
    total += imp;
    const nombre = doc.splitTextToSize(p.nombre, 62) as string[];
    doc.text(p.sku, cols[0]!, y);
    doc.text(nombre, cols[1]!, y);
    doc.text(String(l.planchas), cols[2]!, y, { align: "right" });
    doc.text(formatoMoneda(precio), cols[3]!, y, { align: "right" });
    doc.text(formatoMoneda(imp), cols[4]!, y, { align: "right" });
    y += 5 * nombre.length + 3;
  }

  const base = total / 1.18;
  const igv = total - base;
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, ancho - m, y);
  y += 8;
  const tot = (a: string, b: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(a, 150, y, { align: "right" });
    doc.text(b, ancho - m - 2, y, { align: "right" });
    y += 6;
  };
  tot("Op. gravada:", formatoMoneda(base));
  tot("IGV (18%):", formatoMoneda(igv));
  doc.setFontSize(12);
  tot("TOTAL PAGADO:", formatoMoneda(total), true);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Gracias por su compra. Documento generado electrónicamente.", ancho / 2, 285, {
    align: "center",
  });

  return { blob: doc.output("blob"), nombre: `boleta-${datos.ordenId}.pdf` };
}

export function descargarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
