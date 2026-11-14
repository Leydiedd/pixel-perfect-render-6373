import { reportesSchema } from "./reports-model.ts";
import { z } from "zod";

const fecha = z.string().nullable();
export const productoSchema = z.object({
  id: z.number(),
  sku: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  categorias: z.array(z.string()),
  precio: z.number().nullable(),
  precioConImpuesto: z.number().nullable(),
  impuesto: z.number().nullable(),
  stock: z.number(),
  umbral: z.number().nullable(),
  unidad: z.string().nullable(),
  enVenta: z.boolean(),
  tipo: z.number(),
  gestionaStock: z.boolean(),
  almacenes: z.array(z.object({ id: z.number(), nombre: z.string(), cantidad: z.number() })),
  lotes: z.array(
    z.object({
      lote: z.string(),
      cantidad: z.number(),
      caducidad: fecha,
      ventaHasta: fecha,
      almacen: z.string(),
    }),
  ),
});
const canalVentaSchema = z.enum(["b2b", "b2c"]).nullable().default(null);
const fuenteCanalSchema = z
  .enum(["documento", "vinculado", "cliente", "sin_dato", "conflicto", "reconstruido"])
  .default("sin_dato");
export const facturaSchema = z.object({
  origenDatos: z.enum(["historico", "academico", "portal"]).optional(),
  clienteId: z.number().nullable().optional(),
  pagosResumen: z
    .array(
      z.object({
        codigo: z.string(),
        medio: z.string(),
        demostracion: z.boolean(),
        importe: z.number().finite(),
      }),
    )
    .default([]),
  canal: canalVentaSchema,
  fuenteCanal: fuenteCanalSchema,
  cobrado: z.number(),
  saldo: z.number().nonnegative(),
  pagoPermitido: z.boolean(),
  id: z.number(),
  ref: z.string(),
  cliente: z.string(),
  tipo: z.number(),
  fecha,
  vencimiento: fecha,
  pagada: z.boolean(),
  estado: z.number(),
  subtotal: z.number(),
  impuesto: z.number(),
  total: z.number(),
  pdf: z.boolean(),
});
export const datosSchema = z.object({
  reportes: reportesSchema,
  fuente: z.object({
    base: z.string(),
    consultadoEn: z.string(),
    url: z.string().url(),
    almacenVenta: z.object({ id: z.number(), nombre: z.string() }).nullable(),
  }),
  empresa: z.object({
    nombre: z.string(),
    direccion: fecha,
    localidad: fecha,
    telefono: fecha,
    correo: fecha,
    moneda: z.string(),
  }),
  productos: z.array(productoSchema),
  clientes: z.array(z.object({ id: z.number(), nombre: z.string(), codigo: z.string() })),
  facturas: z.array(facturaSchema),
  pedidos: z.array(
    z.object({
      clienteId: z.number().nullable().optional(),
      id: z.number(),
      ref: z.string(),
      cliente: z.string(),
      fecha,
      entrega: fecha,
      estado: z.number(),
      subtotal: z.number(),
      total: z.number(),
      facturado: z.boolean(),
      cancelablePortal: z.boolean(),
      origenDatos: z.enum(["historico", "academico", "portal"]).optional(),
      modalidad: z.enum(["delivery", "recojo"]).default("delivery"),
      listoRecojo: fecha.default(null),
      puntoRecojo: z.string().nullable().default(null),
      bloqueoPago: z.string().nullable().default("No se pudo verificar el pago de la factura."),
      puedeGestionarRecojo: z.boolean().default(false),
      fechaEntregaReal: fecha.default(null),
      recibidoPor: z.string().nullable().default(null),
      puedeProgramarEntrega: z.boolean().default(false),
      puedeConfirmarEntrega: z.boolean().default(false),
      canal: canalVentaSchema,
      fuenteCanal: fuenteCanalSchema,
      direccionTienda: z.string().nullable().default(null),
    }),
  ),
  expediciones: z.array(
    z.object({
      id: z.number(),
      ref: z.string(),
      cliente: z.string(),
      destino: fecha,
      fecha,
      entrega: fecha,
      estado: z.number(),
      seguimiento: fecha,
    }),
  ),
  almacenes: z.array(
    z.object({
      id: z.number(),
      nombre: z.string(),
      direccion: z.string(),
      abierto: z.boolean(),
      referencias: z.number(),
    }),
  ),
  bancos: z.array(
    z.object({
      id: z.number(),
      nombre: z.string(),
      moneda: z.string(),
      saldo: z.number(),
      abierto: z.boolean(),
      tipo: z.number(),
    }),
  ),
  mediosPago: z.array(z.object({ id: z.number(), codigo: z.string(), nombre: z.string() })),
  totales: z.object({ terceros: z.number(), facturasProveedor: z.number() }),
});
export type DatosDolibarr = z.infer<typeof datosSchema>;
export type ProductoReal = z.infer<typeof productoSchema>;
export type FacturaReal = z.infer<typeof facturaSchema>;
export function estadoFactura(f: Pick<FacturaReal, "pagada" | "estado">) {
  if (f.estado === 0) return "Borrador";
  if (f.pagada) return "Pagada";
  return (
    ({ 1: "Pendiente", 2: "Cerrada", 3: "Anulada" } as Record<number, string>)[f.estado] ??
    `Estado ${f.estado}`
  );
}
export function estadoPedido(estado: number) {
  return (
    (
      { "-1": "Cancelado", 0: "Borrador", 1: "Validado", 2: "En proceso", 3: "Cerrado" } as Record<
        number,
        string
      >
    )[estado] ?? `Estado ${estado}`
  );
}
export function estadoExpedicion(estado: number) {
  return (
    ({ "-1": "Cancelada", 0: "Borrador", 1: "Validada", 2: "Cerrada" } as Record<number, string>)[
      estado
    ] ?? `Estado ${estado}`
  );
}
export function tipoFactura(tipo: number) {
  return (
    (
      {
        0: "Factura",
        1: "Sustitutiva",
        2: "Nota de crédito",
        3: "Anticipo",
        4: "Proforma",
        5: "Situación",
      } as Record<number, string>
    )[tipo] ?? `Tipo ${tipo}`
  );
}
export const formatoMoneda = (valor: number, moneda = "PEN") =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);
export const formatoCantidad = (valor: number) =>
  new Intl.NumberFormat("es-PE", { maximumFractionDigits: 4 }).format(valor);
export const formatoFecha = (valor: string | null) =>
  valor
    ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(`${valor.slice(0, 10)}T12:00:00`),
      )
    : "No registrada";
export function filtrarFacturas(
  facturas: FacturaReal[],
  consulta: string,
  estado = "Todos",
  desde = "",
  hasta = "",
) {
  const q = consulta.trim().toLocaleLowerCase("es");
  return facturas.filter(
    (f) =>
      (!q || `${f.ref} ${f.cliente}`.toLocaleLowerCase("es").includes(q)) &&
      (estado === "Todos" || estadoFactura(f) === estado) &&
      (!desde || (!!f.fecha && f.fecha >= desde)) &&
      (!hasta || (!!f.fecha && f.fecha <= hasta)),
  );
}
export function pagina<T>(items: T[], numero: number, tamano = 25) {
  const totalPaginas = Math.max(1, Math.ceil(items.length / tamano));
  const actual = Math.max(1, Math.min(numero, totalPaginas));
  return {
    items: items.slice((actual - 1) * tamano, actual * tamano),
    actual,
    totalPaginas,
    total: items.length,
  };
}
export function alertasReales(productos: ProductoReal[], hoy: string) {
  const resultado: { id: string; titulo: string; detalle: string; sku: string }[] = [];
  for (const p of productos) {
    if (p.stock < 0 || (p.umbral !== null && p.umbral > 0 && p.stock <= p.umbral))
      resultado.push({
        id: `stock-${p.id}`,
        titulo: `Stock: ${p.nombre}`,
        detalle: `Existencia ${formatoCantidad(p.stock)} · umbral ${formatoCantidad(p.umbral ?? 0)}`,
        sku: p.sku,
      });
    for (const [i, lote] of p.lotes.entries())
      if (lote.cantidad > 0 && lote.caducidad && lote.caducidad < hoy)
        resultado.push({
          id: `lote-${p.id}-${i}`,
          titulo: `Lote vencido: ${lote.lote}`,
          detalle: `${p.nombre} · ${formatoFecha(lote.caducidad)} · ${lote.almacen}`,
          sku: p.sku,
        });
  }
  return resultado;
}
