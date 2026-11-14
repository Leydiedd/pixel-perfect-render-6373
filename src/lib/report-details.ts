import type { DatosDolibarr, FacturaReal } from "./dolibarr-model";
import { coincideCanal, type FiltroCanal } from "./sales-model.ts";
import {
  enPeriodo,
  sumarDinero,
  cumplimientoEntrega,
  etiquetasCumplimiento,
} from "./reports-model.ts";

export type CeldaReporte = string | number | null;
export type FilaReporte = Record<string, CeldaReporte>;
export type ColumnaReporte = {
  key: string;
  titulo: string;
  formato?: "dinero" | "numero" | "porcentaje";
};
export type ReporteDetalle = {
  titulo: string;
  nota: string;
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
};
export type FiltrosReporte = { desde: string; hasta: string; canal: FiltroCanal };
const diaMs = 86400000;
export function fechaValida(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function periodoAnterior(desde: string, hasta: string) {
  if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) return null;
  const inicio = Date.parse(desde + "T00:00:00Z");
  const dias = Math.round((Date.parse(hasta + "T00:00:00Z") - inicio) / diaMs) + 1;
  return {
    desde: new Date(inicio - dias * diaMs).toISOString().slice(0, 10),
    hasta: new Date(inicio - diaMs).toISOString().slice(0, 10),
    dias,
  };
}
export function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / diaMs);
}
export function antiguedadSaldo(vencimiento: string | null, hoy: string) {
  if (!vencimiento || !fechaValida(vencimiento)) return { tramo: "Sin vencimiento", dias: null };
  const dias = Math.max(0, diasEntre(vencimiento, hoy));
  return {
    tramo:
      dias === 0
        ? "Por vencer / vence hoy"
        : dias <= 30
          ? "1–30 días"
          : dias <= 60
            ? "31–60 días"
            : dias <= 90
              ? "61–90 días"
              : "Más de 90 días",
    dias,
  };
}
export const canalTexto = (c: string | null | undefined) =>
  c === "b2b" ? "B2B" : c === "b2c" ? "B2C" : "Sin clasificar";
const vigentes = (f: FacturaReal) => f.estado !== 0 && f.estado !== 3 && f.tipo !== 4;
export function facturasReporte(d: DatosDolibarr, f: FiltrosReporte) {
  return d.facturas.filter(
    (x) => vigentes(x) && enPeriodo(x.fecha, f.desde, f.hasta) && coincideCanal(x.canal, f.canal),
  );
}
export function resumenGerencial(d: DatosDolibarr, filtros: FiltrosReporte) {
  const facturas = facturasReporte(d, filtros),
    ids = new Set(facturas.map((f) => f.id));
  const lineas = d.reportes.ventasLineas.filter((l) => ids.has(l.facturaId));
  const ventas = sumarDinero(facturas.map((f) => f.subtotal));
  const ventasLineas = sumarDinero(lineas.map((l) => l.venta));
  const cubiertas = new Set(lineas.map((l) => l.facturaId));
  const costosCompletos =
    lineas.every((l) => l.costo !== null) &&
    facturas.every((f) => cubiertas.has(f.id) || f.subtotal === 0) &&
    Math.abs(ventasLineas - ventas) < 0.02;
  const margen = costosCompletos ? sumarDinero(lineas.map((l) => l.venta - (l.costo ?? 0))) : null;
  const ventasPositivas = facturas.filter((f) => f.tipo !== 2 && f.subtotal > 0);
  const pendiente = facturas.filter(
    (f) => f.estado === 1 && !f.pagada && f.tipo !== 2 && f.saldo > 0,
  );
  const mapa = new Map(d.facturas.filter(vigentes).map((f) => [f.id, f]));
  const pagos = d.reportes.pagos.filter(
    (p) =>
      mapa.has(p.facturaId) &&
      enPeriodo(p.fecha, filtros.desde, filtros.hasta) &&
      coincideCanal(mapa.get(p.facturaId)!.canal, filtros.canal),
  );
  return {
    facturas,
    lineas,
    ventas,
    margen,
    pendiente,
    pagos,
    cobros: sumarDinero(pagos.map((p) => p.importe)),
    saldo: sumarDinero(pendiente.map((f) => f.saldo)),
    ticket: ventasPositivas.length
      ? sumarDinero(ventasPositivas.map((f) => f.subtotal)) / ventasPositivas.length
      : null,
    facturasTicket: ventasPositivas.length,
    inferidas: facturas.filter((f) => f.fuenteCanal === "cliente").length,
  };
}
const dinero = (key: string, titulo: string): ColumnaReporte => ({
  key,
  titulo,
  formato: "dinero",
});
const numero = (key: string, titulo: string): ColumnaReporte => ({
  key,
  titulo,
  formato: "numero",
});
const text = (key: string, titulo: string): ColumnaReporte => ({ key, titulo });
export function construirDetalles(
  d: DatosDolibarr,
  filtros: FiltrosReporte,
  hoy: string,
): Record<string, ReporteDetalle> {
  const r = resumenGerencial(d, filtros);
  const products = new Map<
    string,
    {
      nombre: string;
      cantidad: number;
      ventas: number[];
      costos: (number | null)[];
      ids: Set<number>;
    }
  >();
  for (const l of r.lineas) {
    const row = products.get(l.sku) ?? {
      nombre: l.producto,
      cantidad: 0,
      ventas: [],
      costos: [],
      ids: new Set<number>(),
    };
    row.cantidad += l.cantidad;
    row.ventas.push(l.venta);
    row.costos.push(l.costo);
    row.ids.add(l.facturaId);
    products.set(l.sku, row);
  }
  const productMap = new Map(d.productos.map((p) => [p.sku, p]));
  const clientes = new Map<
    string,
    { id: number | null; nombre: string; facturas: FacturaReal[]; canales: Set<string> }
  >();
  for (const f of r.facturas) {
    const key = f.clienteId ? String(f.clienteId) : `documento-${f.id}`;
    const c = clientes.get(key) ?? {
      id: f.clienteId ?? null,
      nombre: f.cliente,
      facturas: [],
      canales: new Set<string>(),
    };
    c.facturas.push(f);
    c.canales.add(canalTexto(f.canal));
    clientes.set(key, c);
  }
  const clientRows: FilaReporte[] = [...clientes.values()]
    .map((c) => ({
      id: c.id,
      cliente: c.nombre,
      canal: [...c.canales].sort().join(" / "),
      documentos: c.facturas.length,
      ventas: sumarDinero(c.facturas.map((f) => f.subtotal)),
      saldo: sumarDinero(
        c.facturas.filter((f) => f.estado === 1 && !f.pagada && f.tipo !== 2).map((f) => f.saldo),
      ),
      ultima:
        c.facturas
          .map((f) => f.fecha || "")
          .sort()
          .at(-1) || "Sin fecha",
    }))
    .sort((a, b) => Number(b.ventas) - Number(a.ventas));
  const productRows: FilaReporte[] = [...products]
    .map(([sku, p]) => {
      const venta = sumarDinero(p.ventas),
        costo = p.costos.some((v) => v === null) ? null : sumarDinero(p.costos as number[]);
      const actual = productMap.get(sku);
      const margen = costo === null ? null : sumarDinero([venta, -costo]);
      return {
        sku,
        producto: p.nombre,
        cantidad: Math.round(p.cantidad * 10000) / 10000,
        documentos: p.ids.size,
        ventas: venta,
        costo,
        margen,
        porcentaje: margen !== null && venta > 0 ? (margen / venta) * 100 : null,
        stock: actual?.stock ?? null,
      };
    })
    .sort((a, b) => Number(b.ventas) - Number(a.ventas));
  const aging: FilaReporte[] = r.pendiente
    .map((f) => {
      const a = antiguedadSaldo(f.vencimiento, hoy);
      return {
        factura: f.ref,
        cliente: f.cliente,
        canal: canalTexto(f.canal),
        emision: f.fecha || "Sin fecha",
        vencimiento: f.vencimiento || "Sin fecha",
        saldo: f.saldo,
        tramo: a.tramo,
        dias: a.dias,
      };
    })
    .sort((a, b) => Number(b.saldo) - Number(a.saldo));
  const facturaMap = new Map(d.facturas.map((f) => [f.id, f]));
  const orders = d.pedidos.filter(
    (p) =>
      enPeriodo(p.fecha, filtros.desde, filtros.hasta) &&
      coincideCanal(p.canal, filtros.canal) &&
      [1, 2, 3].includes(p.estado),
  );
  const compras = d.reportes.compras.filter(
    (f) => [1, 2].includes(f.estado) && enPeriodo(f.fecha, filtros.desde, filtros.hasta),
  );
  const produccion = d.reportes.produccion.filter(
    (p) => p.estado !== -1 && enPeriodo(p.fecha, filtros.desde, filtros.hasta),
  );
  return {
    Resumen: {
      titulo: "Resumen ejecutivo",
      nota: "Ventas y margen sin IGV; cobros y saldos con impuestos. Los saldos son actuales, no un cierre histórico. El margen bruto no es EBITDA.",
      columnas: [text("indicador", "Indicador"), dinero("importe", "Importe")],
      filas: [
        { indicador: "Ventas netas sin IGV", importe: r.ventas },
        { indicador: "Margen bruto registrado", importe: r.margen },
        { indicador: "Cobros por fecha de pago", importe: r.cobros },
        { indicador: "Saldo actual de facturas del período", importe: r.saldo },
        { indicador: "Promedio por factura positiva sin IGV", importe: r.ticket },
      ],
    },
    Productos: {
      titulo: "Ventas y margen por producto",
      nota: "Cantidades netas por referencia, considerando notas de crédito. No se suman unidades de productos distintos. Stock actual de todos los almacenes, independiente del período y canal. Costos según la factura.",
      columnas: [
        text("sku", "SKU"),
        text("producto", "Producto"),
        numero("cantidad", "Cantidad neta"),
        dinero("ventas", "Ventas sin IGV"),
        dinero("costo", "Costo registrado"),
        dinero("margen", "Margen bruto"),
        { key: "porcentaje", titulo: "Margen %", formato: "porcentaje" },
        numero("stock", "Stock actual"),
      ],
      filas: productRows,
    },
    Clientes: {
      titulo: "Ventas y saldo por cliente",
      nota: "Agrupado por ID de Dolibarr, no por nombre. Canal de los documentos seleccionados. Ventas netas sin IGV; saldo actual con impuestos. No incluye clientes sin documentos en la selección.",
      columnas: [
        numero("id", "ID cliente"),
        text("cliente", "Cliente"),
        text("canal", "Canal"),
        numero("documentos", "Documentos"),
        dinero("ventas", "Ventas sin IGV"),
        dinero("saldo", "Saldo actual"),
        text("ultima", "Última factura"),
      ],
      filas: clientRows,
    },
    Ventas: {
      titulo: "Detalle de ventas",
      nota: "Por fecha de factura; excluye borradores, anuladas y proformas. Conserva el signo de las notas de crédito.",
      columnas: [
        text("factura", "Documento"),
        text("fecha", "Fecha"),
        text("cliente", "Cliente"),
        text("canal", "Canal"),
        dinero("ventas", "Base sin IGV"),
        dinero("impuesto", "IGV"),
        dinero("total", "Total"),
        dinero("saldo", "Saldo actual"),
      ],
      filas: r.facturas.map((f) => ({
        factura: f.ref,
        fecha: f.fecha || "Sin fecha",
        cliente: f.cliente,
        canal: canalTexto(f.canal),
        ventas: f.subtotal,
        impuesto: f.impuesto,
        total: f.total,
        saldo: f.saldo,
      })),
    },
    Cobranza: {
      titulo: "Antigüedad de saldos pendientes",
      nota: `Saldo actual de las facturas emitidas en el período. Días calendario de atraso al ${hoy}; la fecha final del filtro no reconstruye el saldo de aquel día.`,
      columnas: [
        text("factura", "Factura"),
        text("cliente", "Cliente"),
        text("canal", "Canal"),
        text("vencimiento", "Vencimiento"),
        text("tramo", "Antigüedad"),
        numero("dias", "Días vencidos"),
        dinero("saldo", "Saldo actual"),
      ],
      filas: aging,
    },
    Pagos: {
      titulo: "Cobros registrados",
      nota: "Por fecha de pago. Cada fila es un importe aplicado a una factura, no necesariamente un pago independiente. Excluye aplicaciones anuladas y documentos anulados.",
      columnas: [
        text("fecha", "Fecha de pago"),
        text("factura", "Factura"),
        text("cliente", "Cliente"),
        text("canal", "Canal"),
        text("metodo", "Método"),
        dinero("importe", "Importe aplicado"),
      ],
      filas: r.pagos.map((p) => ({
        fecha: p.fecha || "Sin fecha",
        factura: facturaMap.get(p.facturaId)!.ref,
        cliente: facturaMap.get(p.facturaId)!.cliente,
        canal: canalTexto(facturaMap.get(p.facturaId)!.canal),
        metodo: p.metodo,
        importe: p.importe,
      })),
    },
    Entregas: {
      titulo: "Entregas y recojos por pedido",
      nota: "Pedidos vigentes por fecha de creación. La salida de almacén no equivale a recepción. La puntualidad solo se calcula para delivery con fecha prevista.",
      columnas: [
        text("pedido", "Pedido"),
        text("cliente", "Cliente"),
        text("modalidad", "Modalidad"),
        text("prevista", "Fecha prevista"),
        text("real", "Fecha recibida"),
        text("cumplimiento", "Situación"),
      ],
      filas: orders.map((p) => ({
        pedido: p.ref,
        cliente: p.cliente,
        modalidad: p.modalidad === "recojo" ? "Recojo" : "Delivery",
        prevista: p.modalidad === "recojo" ? "No aplica" : p.entrega || "Sin programar",
        real: p.fechaEntregaReal || "Sin confirmar",
        cumplimiento:
          p.modalidad === "recojo"
            ? p.fechaEntregaReal
              ? "Retirado"
              : p.listoRecojo
                ? "Listo para recoger"
                : "En preparación"
            : etiquetasCumplimiento[cumplimientoEntrega(p, hoy).estado],
      })),
    },
    Inventario: {
      titulo: "Existencias y reposición",
      nota: "Fotografía actual, sin filtro de fecha ni canal. Unidades por producto; el mínimo y el stock mostrado son globales. No representa inventario histórico.",
      columnas: [
        text("sku", "SKU"),
        text("producto", "Producto"),
        text("unidad", "Unidad"),
        numero("stock", "Stock actual"),
        numero("minimo", "Mínimo"),
        text("situacion", "Situación"),
      ],
      filas: d.productos
        .filter((p) => p.gestionaStock)
        .map((p) => ({
          sku: p.sku,
          producto: p.nombre,
          unidad: p.unidad || "Sin definir",
          stock: p.stock,
          minimo: p.umbral,
          situacion:
            p.stock <= 0
              ? "Sin existencias"
              : p.umbral !== null && p.umbral > 0 && p.stock < p.umbral
                ? "Bajo mínimo"
                : !p.umbral || p.umbral <= 0
                  ? "Sin mínimo configurado"
                  : "Sobre mínimo",
        })),
    },
    Compras: {
      titulo: "Compras a proveedores",
      nota: "Facturas de proveedor validadas por fecha de emisión; importes sin IGV. No se aplica el filtro B2B/B2C.",
      columnas: [
        text("factura", "Documento"),
        text("fecha", "Fecha"),
        text("proveedor", "Proveedor"),
        dinero("total", "Base sin IGV"),
        text("pago", "Estado de pago"),
      ],
      filas: compras.map((f) => ({
        factura: f.ref,
        fecha: f.fecha || "Sin fecha",
        proveedor: f.proveedor,
        total: f.total,
        pago: f.pagada ? "Pagada" : "No pagada",
      })),
    },
    Producción: {
      titulo: "Órdenes de fabricación",
      nota: "Por inicio planificado. Diferencia = producido menos previsto, por orden y unidad. No equivale a merma ni a eficiencia de máquina.",
      columnas: [
        text("orden", "Orden"),
        text("producto", "Producto"),
        text("fecha", "Inicio previsto"),
        text("unidad", "Unidad"),
        numero("previsto", "Previsto"),
        numero("real", "Producido"),
        numero("diferencia", "Diferencia"),
        text("estado", "Estado"),
      ],
      filas: produccion.map((p) => ({
        orden: p.ref,
        producto: p.producto,
        fecha: p.fecha || "Sin fecha",
        unidad: p.unidad,
        previsto: p.previsto,
        real: p.producido,
        diferencia: p.producido - p.previsto,
        estado:
          (
            { 0: "Borrador", 1: "Validada", 2: "En curso", 3: "Terminada" } as Record<
              number,
              string
            >
          )[p.estado] || String(p.estado),
      })),
    },
  };
}
