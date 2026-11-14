import type { ReporteDetalle, FilaReporte } from "./report-details";
// Whole filtered scope. Never total percentages, stock quantities, averages, or heterogeneous indicators.
export function datosExplicacionExportacion(reporte: ReporteDetalle, filas: FilaReporte[]) {
  const numeric = reporte.columnas.filter((c) => c.formato === "dinero");
  const sums =
    reporte.titulo === "Resumen ejecutivo" || reporte.columnas.some((c) => c.key === "indicador")
      ? []
      : numeric.map((c) => {
          const values = filas.map((r) => r[c.key]);
          const known = values.filter((v): v is number => typeof v === "number");
          return {
            columna: c.titulo,
            sumaConocida: Math.round(known.reduce((a, b) => a + b, 0) * 100) / 100,
            filasConDato: known.length,
            filasSinDato: values.length - known.length,
          };
        });
  return {
    totalFiltrado: filas.length,
    alcance:
      "Totales monetarios calculados con TODAS las filas filtradas. Si faltan datos, las sumas son parciales. Las primeras 30 filas son una muestra, no el total. No sumar columnas entre sí: pueden ser bases, subtotales o saldos de las mismas operaciones.",
    columnas: reporte.columnas,
    totalesMonetarios: sums,
    muestraPrimerasFilas: filas.slice(0, 30),
  };
}
