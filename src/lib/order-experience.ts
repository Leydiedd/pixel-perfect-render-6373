import type { Catalogo } from "./store-model";
export type PagoPedido = {
  estado:
    "pendiente" | "parcial" | "pagado" | "sin_factura" | "cancelado" | "revisar" | "por_conciliar";
  saldo: number;
  total: number;
  cobrado: number;
  creditos: number;
  facturas: { id: number; ref: string; estado: number; total: number; saldo: number }[];
};
export const textoPago: Record<PagoPedido["estado"], string> = {
  pendiente: "Pendiente de pago",
  parcial: "Parcialmente pagado",
  pagado: "Pagado",
  sin_factura: "Factura pendiente de emisión",
  cancelado: "Pedido cancelado",
  revisar: "Facturación por revisar",
  por_conciliar: "Pago por conciliar",
};
export type DetallePedido = {
  id: number;
  ref: string;
  cliente: string;
  modalidad: "delivery" | "recojo";
  entrega: { contacto: string; telefono: string; direccion: string; ciudad: string } | null;
  contactoActual: { telefono: string; direccion: string; ciudad: string; correo: string };
  puntoRecojo: string | null;
  recibidoPor: string | null;
  moneda: string;
  pago: PagoPedido;
  lineas: {
    productoId: number;
    sku: string;
    nombre: string;
    cantidad: number;
    precio: number;
    impuesto: number;
    total: number;
  }[];
  historial: { id: string; tipo: string; fecha: string | null; titulo: string; detalle: string }[];
};
export function prepararRepeticion(
  actual: { id: number; cantidad: number }[],
  anteriores: { productoId?: number; nombre: string; cantidad: number }[],
  catalogo: Catalogo,
) {
  const next = actual.map((v) => ({ ...v }));
  const avisos: string[] = [];
  let unidades = 0;
  for (const line of anteriores) {
    const p = catalogo.productos.find((p) => p.id === line.productoId);
    if (!p?.comprable || !Number.isInteger(line.cantidad) || line.cantidad <= 0) {
      avisos.push(`${line.nombre}: no disponible para repetir.`);
      continue;
    }
    const prior = next.find((v) => v.id === p.id);
    if (!prior && next.length >= 100) {
      avisos.push(`${p.nombre}: el carrito admite hasta 100 productos.`);
      continue;
    }
    const n = Math.max(
      0,
      Math.min(
        line.cantidad,
        Math.floor(p.disponible) - (prior?.cantidad ?? 0),
        1000000 - (prior?.cantidad ?? 0),
      ),
    );
    if (n < line.cantidad)
      avisos.push(`${p.nombre}: añadidas ${n} de ${line.cantidad} por disponibilidad actual.`);
    if (!n) continue;
    if (prior) prior.cantidad += n;
    else next.push({ id: p.id, cantidad: n });
    unidades += n;
  }
  return { carrito: next, avisos, unidades };
}
