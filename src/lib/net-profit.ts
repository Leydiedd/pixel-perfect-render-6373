import type { DatosDolibarr } from "./dolibarr-model";
import type { ReporteDetalle } from "./report-details";
export type MesNeto = NonNullable<DatosDolibarr["reportes"]["gananciaNeta"]>[number];
export const notaNeta =
  "Resultado académico global, sin repartir gastos entre B2B y B2C. Ventas sin IGV menos costo vendido, gastos operativos, depreciación, intereses y provisión de renta registrada. Las compras de materias primas no se restan nuevamente. Los filtros seleccionan meses completos; el mes abierto llega solo al corte indicado. No es flujo de caja ni una declaración tributaria.";
export function filtrarMeses(rows: MesNeto[], desde: string, hasta: string) {
  return rows.filter(
    (r) => (!desde || r.mes >= desde.slice(0, 7)) && (!hasta || r.mes <= hasta.slice(0, 7)),
  );
}
export function reporteNeto(rows: MesNeto[], simple = false): ReporteDetalle {
  return {
    titulo: simple
      ? "Ganancia neta por mes"
      : "Resultado mensual: de las ventas a la ganancia neta",
    nota: notaNeta,
    columnas: simple
      ? [
          { key: "mes", titulo: "Mes" },
          { key: "neta", titulo: "Ganancia neta (S/)", formato: "dinero" },
          { key: "estado", titulo: "Estado" },
          { key: "corte", titulo: "Corte de gastos" },
        ]
      : [
          { key: "mes", titulo: "Mes" },
          ...[
            ["ventas", "Ventas sin IGV"],
            ["costo", "Costo vendido"],
            ["bruto", "Margen bruto"],
            ["operativos", "Gastos operativos"],
            ["depreciacion", "Depreciación"],
            ["financieros", "Intereses"],
            ["antesRenta", "Antes de renta"],
            ["renta", "Provisión renta"],
            ["neta", "Ganancia neta"],
          ].map(([key, titulo]) => ({ key: key!, titulo: titulo!, formato: "dinero" as const })),
          { key: "estado", titulo: "Estado" },
        ],
    filas: rows.map((r) => ({ ...r })),
  };
}
export function resumenNeto(rows: MesNeto[]) {
  const valid = rows.filter((r) => r.neta !== null);
  const sum = (key: keyof MesNeto) =>
    Math.round(valid.reduce((n, r) => n + Number(r[key] ?? 0), 0) * 100) / 100;
  return {
    meses: valid.length,
    incompletos: rows.length - valid.length,
    ventas: sum("ventas"),
    neta: sum("neta"),
    bruto: sum("bruto"),
    gastos:
      Math.round(
        (sum("operativos") + sum("depreciacion") + sum("financieros") + sum("renta")) * 100,
      ) / 100,
  };
}
