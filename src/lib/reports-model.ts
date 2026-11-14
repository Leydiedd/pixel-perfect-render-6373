import { z } from "zod";
const date = z.string().nullable();
export const reportesSchema = z
  .object({
    gananciaNeta: z
      .array(
        z.object({
          mes: z.string(),
          ventas: z.number(),
          costo: z.number(),
          servicios: z.number(),
          nomina: z.number(),
          beneficios: z.number(),
          depreciacion: z.number(),
          financieros: z.number(),
          renta: z.number(),
          otros: z.number(),
          sinClasificar: z.number(),
          sinCosto: z.number(),
          corte: z.string().nullable(),
          estado: z.string(),
          bruto: z.number().nullable(),
          operativos: z.number(),
          antesRenta: z.number().nullable(),
          neta: z.number().nullable(),
        }),
      )
      .optional(),
    ventasLineas: z.array(
      z.object({
        facturaId: z.number(),
        producto: z.string(),
        sku: z.string(),
        cantidad: z.number(),
        venta: z.number(),
        costo: z.number().nullable(),
      }),
    ),
    pagos: z.array(
      z.object({ facturaId: z.number(), fecha: date, importe: z.number(), metodo: z.string() }),
    ),
    compras: z.array(
      z.object({
        id: z.number(),
        ref: z.string(),
        fecha: date,
        proveedor: z.string(),
        total: z.number(),
        pagada: z.boolean(),
        estado: z.number(),
        tipo: z.number(),
      }),
    ),
    recepciones: z
      .array(
        z.object({
          id: z.number(),
          ref: z.string(),
          proveedor: z.string(),
          prevista: date,
          recibida: date,
          estado: z.number(),
        }),
      )
      .optional(),
    produccion: z.array(
      z.object({
        id: z.number(),
        ref: z.string(),
        estado: z.number(),
        producto: z.string(),
        sku: z.string(),
        unidad: z.string(),
        previsto: z.number(),
        producido: z.number(),
        fecha: date,
        finPrevisto: date,
        ultimoMovimiento: date,
      }),
    ),
  })
  .default({ ventasLineas: [], pagos: [], compras: [], produccion: [] });
export function enPeriodo(fecha: string | null, desde: string, hasta: string) {
  return (!desde || (!!fecha && fecha >= desde)) && (!hasta || (!!fecha && fecha <= hasta));
}
export function sumarDinero(items: number[]) {
  return items.reduce((n, v) => n + Math.round(v * 100), 0) / 100;
}
export function agruparImportes<T>(rows: T[], clave: (r: T) => string, valor: (r: T) => number) {
  const groups = new Map<string, number>();
  for (const r of rows) {
    const k = clave(r);
    groups.set(k, (groups.get(k) || 0) + Math.round(valor(r) * 100));
  }
  return [...groups]
    .map(([nombre, v]) => ({ nombre, importe: v / 100 }))
    .sort((a, b) => b.importe - a.importe);
}
export function resumenEntregas<
  T extends { estado: number; fechaEntregaReal: string | null; entrega: string | null },
>(
  pedidos: T[],
  hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()),
) {
  const vigentes = pedidos.filter((p) => [1, 2, 3].includes(p.estado));
  const entregados = vigentes.filter((p) => p.fechaEntregaReal);
  const medibles = entregados.filter((p) => p.entrega);
  return {
    total: vigentes.length,
    entregados: entregados.length,
    sinConfirmar: vigentes.length - entregados.length,
    medibles: medibles.length,
    aTiempo: medibles.filter((p) => p.fechaEntregaReal! <= p.entrega!).length,
    conRetraso: medibles.filter((p) => p.fechaEntregaReal! > p.entrega!).length,
    sinFechaPrevista: entregados.length - medibles.length,
    vencidos: vigentes.filter((p) => cumplimientoEntrega(p, hoy).estado === "vencido").length,
  };
}

export const etiquetasCumplimiento = {
  a_tiempo: "Entregado a tiempo",
  con_retraso: "Entregado con retraso",
  sin_fecha: "Entregado sin fecha prevista",
  vencido: "Sin confirmar · vencido",
  pendiente: "Pendiente dentro del plazo",
  sin_programar: "Sin fecha prevista",
  no_aplica: "No aplica",
} as const;
export function cumplimientoEntrega(
  p: { estado: number; entrega: string | null; fechaEntregaReal: string | null },
  hoy: string,
): { estado: keyof typeof etiquetasCumplimiento; diasRetraso: number | null } {
  if (![1, 2, 3].includes(p.estado)) return { estado: "no_aplica", diasRetraso: null };
  if (!p.entrega)
    return { estado: p.fechaEntregaReal ? "sin_fecha" : "sin_programar", diasRetraso: null };
  const dias = (a: string, b: string) =>
    Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
  if (p.fechaEntregaReal) {
    const n = dias(p.fechaEntregaReal, p.entrega);
    return { estado: n > 0 ? "con_retraso" : "a_tiempo", diasRetraso: Math.max(0, n) };
  }
  return hoy > p.entrega
    ? { estado: "vencido", diasRetraso: dias(hoy, p.entrega) }
    : { estado: "pendiente", diasRetraso: null };
}
