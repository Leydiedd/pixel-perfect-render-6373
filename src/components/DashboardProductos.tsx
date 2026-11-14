import { ComentarioReporte } from "@/components/ComentarioReporte";
import { GraficoRanking } from "@/components/GraficoRanking";
import { useState } from "react";
import type { FilaReporte } from "@/lib/report-details";
import { sumarDinero } from "@/lib/reports-model";
import { formatoMoneda } from "@/lib/dolibarr-model";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Vacio } from "@/components/DatosReales";

export function DashboardProductos({ filas, moneda }: { filas: FilaReporte[]; moneda: string }) {
  const [criterio, setCriterio] = useState<"ventas" | "margen">("ventas");
  const productos = filas.map((fila) => ({
    sku: String(fila["sku"]),
    nombre: String(fila["producto"]),
    ventas: Number(fila["ventas"]),
    margen: typeof fila["margen"] === "number" ? fila["margen"] : null,
  }));
  const ventas = sumarDinero(productos.map((p) => p.ventas));
  const margen =
    productos.length && productos.every((p) => p.margen !== null)
      ? sumarDinero(productos.map((p) => p.margen!))
      : null;
  const lider = [...productos].filter((p) => p.ventas > 0).sort((a, b) => b.ventas - a.ventas)[0];
  const ranking = productos
    .filter((p) => p[criterio] !== null && p[criterio]! > 0)
    .sort((a, b) => b[criterio]! - a[criterio]! || a.sku.localeCompare(b.sku))
    .slice(0, 10);
  const money = (n: number) => formatoMoneda(n, moneda);
  const metricas = [
    {
      titulo: "Ventas de productos sin IGV",
      valor: money(ventas),
      detalle: "Importe neto de las líneas del reporte.",
    },
    {
      titulo: "Productos con ventas positivas",
      valor: productos.filter((p) => p.ventas > 0).length.toLocaleString("es-PE"),
      detalle: "Referencias distintas en el período y canal seleccionados.",
    },
    {
      titulo: "Producto líder en ventas",
      valor: lider?.nombre ?? "Sin ventas positivas",
      detalle: lider
        ? `${lider.sku} · ${money(lider.ventas)} sin IGV`
        : "Selecciona otro período o canal.",
    },
    {
      titulo: "Margen bruto de productos",
      valor: margen === null ? "Sin datos suficientes" : money(margen),
      detalle:
        margen !== null && ventas > 0
          ? `${((margen / ventas) * 100).toFixed(1)}% de las ventas · antes de gastos operativos.`
          : "Ventas menos costos registrados en las líneas.",
    },
  ];
  return (
    <section className="space-y-4" aria-label="Dashboard de productos vendidos">
      <div>
        <h2 className="text-lg font-semibold">¿Qué productos generan más ventas?</h2>
        <p className="text-sm text-muted-foreground">
          Resultados según el período y canal seleccionados. Importes sin IGV.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricas.map((m) => (
          <Card key={m.titulo} className="min-w-0 gap-3 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.titulo}
            </p>
            <p className="break-words text-xl font-bold tabular-nums">{m.valor}</p>
            <p className="text-xs text-muted-foreground">{m.detalle}</p>
          </Card>
        ))}
      </div>
      <Card className="gap-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">
              {criterio === "ventas"
                ? "Top 10 productos por ventas"
                : "Top 10 productos por margen bruto"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {criterio === "ventas"
                ? "Ordenados por importe vendido, no por cantidad de unidades."
                : "Ordenados por aporte en soles; se excluyen productos con costos incompletos."}
            </p>
          </div>
          <div className="flex gap-2" role="group" aria-label="Ordenar ranking de productos">
            <Button
              size="sm"
              variant={criterio === "ventas" ? "default" : "outline"}
              aria-pressed={criterio === "ventas"}
              onClick={() => setCriterio("ventas")}
            >
              Ventas
            </Button>
            <Button
              size="sm"
              variant={criterio === "margen" ? "default" : "outline"}
              aria-pressed={criterio === "margen"}
              onClick={() => setCriterio("margen")}
            >
              Margen bruto
            </Button>
          </div>
        </div>
        {ranking.length ? (
          <GraficoRanking
            titulo={
              criterio === "ventas"
                ? "Top 10 productos por ventas"
                : "Top 10 productos por margen bruto"
            }
            moneda={moneda}
            color={criterio === "ventas" ? "#203750" : "#d2182a"}
            datos={ranking.map((p) => ({
              id: p.sku,
              nombre: p.nombre,
              importe: p[criterio]!,
              detalle: `${p.sku} · ${criterio === "ventas" ? "Ventas netas" : "Margen bruto"}`,
            }))}
          />
        ) : (
          <Vacio>
            No hay productos con {criterio === "ventas" ? "ventas" : "margen conocido"} positivas
            para esta selección.
          </Vacio>
        )}
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Las barras comparan importes en soles. El ranking muestra hasta 10 productos con importe
          positivo; la tabla inferior conserva todos los resultados, incluidos valores cero,
          negativos y costos faltantes. Se consideran las notas de crédito. El buscador de la tabla
          solo filtra el detalle.
        </p>
        <ComentarioReporte
          titulo={
            criterio === "ventas"
              ? "Productos con mayores ventas"
              : "Productos con mayor margen bruto"
          }
          datos={{ criterio, ventasTotales: ventas, margenTotal: margen, ranking }}
          nota={
            "Importes sin IGV, top 10 positivo. Margen bruto antes de gastos, no ganancia neta. No confundir ranking por importe con unidades vendidas."
          }
        />
      </Card>
    </section>
  );
}
