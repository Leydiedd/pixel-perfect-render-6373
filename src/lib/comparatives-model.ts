import type { DatosDolibarr } from "./dolibarr-model";
import { resumenGerencial, type FiltrosReporte } from "./report-details.ts";
import { enPeriodo, sumarDinero } from "./reports-model.ts";
export type OrigenDatos = "todos" | "historico" | "academico" | "portal";
export function filtrarOrigen(d: DatosDolibarr, origen: OrigenDatos): DatosDolibarr {
  if (origen === "todos") return d;
  return {
    ...d,
    facturas: d.facturas.filter((f) => (f.origenDatos ?? "historico") === origen),
    pedidos: d.pedidos.filter((p) => (p.origenDatos ?? "historico") === origen),
  };
}
export function comparativasComerciales(d: DatosDolibarr, filtros: FiltrosReporte) {
  const r = resumenGerencial(d, filtros);
  const positivas = r.facturas.filter((f) => f.tipo !== 2 && f.subtotal > 0);
  const primeras = new Map<number, string>();
  for (const f of d.facturas)
    if (
      f.clienteId &&
      f.fecha &&
      f.estado !== 0 &&
      f.estado !== 3 &&
      f.tipo !== 2 &&
      f.tipo !== 4 &&
      f.subtotal > 0
    ) {
      if (!primeras.has(f.clienteId) || f.fecha < primeras.get(f.clienteId)!)
        primeras.set(f.clienteId, f.fecha);
    }
  const canales = (["b2b", "b2c"] as const).map((canal) => {
    const fs = positivas.filter((f) => f.canal === canal),
      ids = [...new Set(fs.flatMap((f) => (f.clienteId ? [f.clienteId] : [])))];
    const nuevos = ids.filter((id) =>
      enPeriodo(primeras.get(id) ?? null, filtros.desde, filtros.hasta),
    ).length;
    const detalle = resumenGerencial(
      { ...d, facturas: r.facturas.filter((factura) => factura.canal === canal) },
      filtros,
    );
    const margen = detalle.facturas.length ? detalle.margen : null;
    return {
      canal,
      compras: fs.length,
      ventas: detalle.ventas,
      margen,
      porcentajeMargen:
        margen !== null && detalle.ventas > 0 ? (100 * margen) / detalle.ventas : null,
      documentos: detalle.facturas.length,
      ticket: fs.length ? sumarDinero(fs.map((f) => f.subtotal)) / fs.length : null,
      clientes: ids.length,
      nuevos,
      recurrentes: ids.length - nuevos,
    };
  });
  const meses = new Map<string, { mes: string; b2b: number; b2c: number }>();
  for (const f of positivas)
    if (f.fecha && (f.canal === "b2b" || f.canal === "b2c")) {
      const mes = f.fecha.slice(0, 7),
        row = meses.get(mes) ?? { mes, b2b: 0, b2c: 0 };
      row[f.canal]++;
      meses.set(mes, row);
    }
  const mapa = new Map(d.facturas.map((f) => [f.id, f]));
  const metodos = new Map<
    string,
    { metodo: string; b2b: number; b2c: number; importeB2b: number; importeB2c: number }
  >();
  for (const p of r.pagos) {
    const f = mapa.get(p.facturaId);
    if (f?.canal !== "b2b" && f?.canal !== "b2c") continue;
    const row = metodos.get(p.metodo) ?? {
      metodo: p.metodo,
      b2b: 0,
      b2c: 0,
      importeB2b: 0,
      importeB2c: 0,
    };
    row[f.canal]++;
    const key = f.canal === "b2b" ? "importeB2b" : "importeB2c";
    row[key] = sumarDinero([row[key], p.importe]);
    metodos.set(p.metodo, row);
  }
  const methods = [...metodos.values()].sort((a, b) => b.b2b + b.b2c - (a.b2b + a.b2c));
  const tb = methods.reduce((n, m) => n + m.b2b, 0),
    tc = methods.reduce((n, m) => n + m.b2c, 0);
  return {
    canales,
    meses: [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
    metodos: methods.map((m) => ({
      ...m,
      pctB2b: tb ? (100 * m.b2b) / tb : 0,
      pctB2c: tc ? (100 * m.b2c) / tc : 0,
    })),
  };
}
export function crecimientoPorCanal(d: DatosDolibarr, filtros: FiltrosReporte) {
  const fs = resumenGerencial(d, { ...filtros, desde: "", hasta: "" }).facturas;
  const meses = new Map<string, { mes: string; b2b: number; b2c: number }>();
  for (const f of fs)
    if (f.fecha && (f.canal === "b2b" || f.canal === "b2c")) {
      const mes = f.fecha.slice(0, 7),
        r = meses.get(mes) ?? { mes, b2b: 0, b2c: 0 };
      r[f.canal] = sumarDinero([r[f.canal], f.subtotal]);
      meses.set(mes, r);
    }
  return [...meses.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((r) => {
      const [y, m] = r.mes.split("-").map(Number);
      const prevKey = new Date(Date.UTC(y!, m! - 2, 1)).toISOString().slice(0, 7);
      const prev = meses.get(prevKey);
      return {
        mes: r.mes,
        b2b: prev && prev.b2b > 0 ? (100 * (r.b2b - prev.b2b)) / prev.b2b : null,
        b2c: prev && prev.b2c > 0 ? (100 * (r.b2c - prev.b2c)) / prev.b2c : null,
      };
    })
    .filter((r) => {
      const [y, m] = r.mes.split("-").map(Number);
      const end = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
      return (
        (!filtros.desde || r.mes + "-01" >= filtros.desde) &&
        (!filtros.hasta || end <= filtros.hasta)
      );
    });
}
