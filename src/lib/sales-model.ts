import type { FacturaReal } from "./dolibarr-model";

export type FiltroCanal = "todos" | "b2b" | "b2c" | "sin_clasificar";
export const canalesVenta = [
  ["todos", "Todas las ventas"],
  ["b2b", "B2B · Negocios"],
  ["b2c", "B2C · Hogar"],
  ["sin_clasificar", "Sin clasificar"],
] as const;
export function coincideCanal(canal: string | null | undefined, filtro: FiltroCanal) {
  return filtro === "todos" || (filtro === "sin_clasificar" ? !canal : canal === filtro);
}
export function resumenVentas(
  facturas: FacturaReal[],
  desde = "",
  hasta = "",
  canal: FiltroCanal = "todos",
) {
  const periodo = facturas.filter(
    (f) =>
      f.estado !== 0 &&
      f.estado !== 3 &&
      f.tipo !== 4 &&
      (!desde || (!!f.fecha && f.fecha >= desde)) &&
      (!hasta || (!!f.fecha && f.fecha <= hasta)),
  );
  const seleccion = periodo.filter((f) => coincideCanal(f.canal, canal));
  const cents = (v: number) => Math.round(v * 100);
  const importe = (rows: FacturaReal[]) => rows.reduce((n, f) => n + cents(f.subtotal), 0) / 100;
  const grupos = (["b2b", "b2c", "sin_clasificar"] as const).map((key) => {
    const rows = periodo.filter((f) => coincideCanal(f.canal, key));
    return {
      canal: key,
      importe: importe(rows),
      documentos: rows.length,
      segunCliente: rows.filter((f) => f.fuenteCanal === "cliente").length,
    };
  });
  const meses = new Map<
    string,
    { mes: string; b2b: number; b2c: number; sin_clasificar: number }
  >();
  for (const f of seleccion)
    if (f.fecha) {
      const mes = f.fecha.slice(0, 7);
      const row = meses.get(mes) ?? { mes, b2b: 0, b2c: 0, sin_clasificar: 0 };
      row[f.canal ?? "sin_clasificar"] += cents(f.subtotal);
      meses.set(mes, row);
    }
  return {
    seleccion,
    grupos,
    total: importe(seleccion),
    segunCliente: seleccion.filter((f) => f.fuenteCanal === "cliente").length,
    sinFecha: seleccion.filter((f) => !f.fecha).length,
    meses: [...meses.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12)
      .map((r) => ({
        mes: r.mes,
        b2b: r.b2b / 100,
        b2c: r.b2c / 100,
        sin_clasificar: r.sin_clasificar / 100,
      })),
  };
}
