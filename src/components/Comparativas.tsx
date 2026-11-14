import { ComentarioReporte } from "@/components/ComentarioReporte";
import { useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
} from "recharts";
import type { DatosDolibarr } from "@/lib/dolibarr-model";
import { formatoMoneda } from "@/lib/dolibarr-model";
import { comparativasComerciales, crecimientoPorCanal } from "@/lib/comparatives-model";
import type { FiltrosReporte } from "@/lib/report-details";
import { coincideCanal } from "@/lib/sales-model";
import { enPeriodo } from "@/lib/reports-model";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TablaAdaptable } from "@/components/TablaAdaptable";
const blue = "#203750",
  red = "#d2182a";
type Props = { datos: DatosDolibarr; filtros: FiltrosReporte; hoy: string };
function SmallChart({
  rows,
  percent = false,
  x = "mes",
  b = "b2b",
  c = "b2c",
}: {
  rows: Record<string, string | number>[];
  percent?: boolean;
  x?: string;
  b?: string;
  c?: string;
}) {
  return (
    <div
      className="h-72 min-w-0"
      role="img"
      aria-label={
        percent ? "Comparativa porcentual por canal" : "Comparativa de cantidades por canal"
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 15, right: 12, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={x}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            angle={x === "metodo" ? -12 : 0}
          />
          <YAxis tick={{ fontSize: 10 }} unit={percent ? "%" : ""} />
          <Tooltip
            formatter={(value) =>
              percent ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString("es-PE")
            }
          />
          <Legend />
          <Bar dataKey={b} name="B2B" fill={blue} radius={[3, 3, 0, 0]} />
          <Bar dataKey={c} name="B2C" fill={red} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function TarjetasCanales({ datos: d, filtros: f }: Pick<Props, "datos" | "filtros">) {
  const canales = comparativasComerciales(d, f).canales.filter((c) =>
    coincideCanal(c.canal, f.canal),
  );
  if (!canales.length) return null;
  const money = (n: number) => formatoMoneda(n, d.empresa.moneda);
  return (
    <section aria-label="Resultados comerciales por canal" className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Valor de las ventas por canal</h2>
        <p className="text-sm text-muted-foreground">
          Ventas, tamaño de compra y margen según los filtros seleccionados.
        </p>
      </div>
      <div className={`grid gap-4 ${canales.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {canales.map((c) => (
          <Card
            key={c.canal}
            className="min-w-0 gap-4 overflow-hidden border-t-4 p-4 sm:p-6"
            style={{ borderTopColor: c.canal === "b2b" ? blue : red }}
          >
            <h3 className="text-lg font-semibold">
              {c.canal === "b2b" ? "B2B · Negocios" : "B2C · Hogar"}
            </h3>
            {!c.documentos && (
              <p className="text-sm text-muted-foreground">
                Sin facturas válidas para este canal y selección.
              </p>
            )}
            <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Ventas netas sin IGV</dt>
                <dd className="mt-1 break-words text-3xl font-bold tabular-nums sm:text-4xl">
                  {money(c.ventas)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">Compras facturadas</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {c.compras.toLocaleString("es-PE")}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cantidad de facturas de venta positivas
                </p>
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">Ticket promedio sin IGV</dt>
                <dd className="mt-1 break-words text-2xl font-semibold tabular-nums">
                  {c.ticket === null ? "—" : money(c.ticket)}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground">
                  Importe promedio por compra facturada
                </p>
              </div>
              <div className="min-w-0 border-t pt-4 sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Margen bruto registrado</dt>
                <dd
                  className={`mt-1 break-words text-2xl font-semibold tabular-nums ${c.margen !== null && c.margen < 0 ? "text-red-700" : ""}`}
                >
                  {c.margen === null
                    ? c.documentos
                      ? "Sin datos suficientes"
                      : "—"
                    : money(c.margen)}
                </dd>
                <p className="mt-1 text-sm">
                  {c.porcentajeMargen !== null
                    ? `${c.porcentajeMargen.toLocaleString("es-PE", { maximumFractionDigits: 1 })}% de las ventas netas`
                    : c.documentos
                      ? "Requiere ventas netas positivas y costos completos para calcular el porcentaje."
                      : "Sin operaciones para calcular margen."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ventas menos costo registrado de los productos. Antes de gastos operativos.
                </p>
              </div>
            </dl>
            <p className="border-t pt-3 text-xs text-muted-foreground">
              {c.clientes} clientes con compras · {c.nuevos} con primera compra en el período ·{" "}
              {c.recurrentes} que ya compraban.
            </p>
            <ComentarioReporte
              titulo={`Ventas del canal ${c.canal}`}
              datos={{
                ventasSinIGV: c.ventas,
                comprasFacturadas: c.compras,
                ticketPromedioSinIGV: c.ticket,
                margenBruto: c.margen,
                porcentajeMargen: c.porcentajeMargen,
                clientesConCompras: c.clientes,
              }}
              nota={
                "Ventas netas sin IGV. Compras: facturas positivas. Ticket: promedio por compra. Margen bruto no es ganancia neta."
              }
            />
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Las ventas y el margen incluyen notas de crédito con su signo; compras y ticket las
        excluyen. Se omiten borradores, anuladas y proformas. El margen bruto no es utilidad neta.
        Primera compra según el historial y origen seleccionados.
      </p>
    </section>
  );
}
export function ComparativasCanales({ datos: d, filtros: f, hoy }: Props) {
  const r = comparativasComerciales(d, f),
    growth = crecimientoPorCanal(d, f).filter((m) => m.mes < hoy.slice(0, 7));
  return (
    <section aria-label="Actividad y evolución por canal" className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Actividad y evolución por canal</h2>
        <p className="text-sm text-muted-foreground">
          Complementa los importes de arriba: más compras no implica mayores ventas ni mayor margen.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-semibold">Cantidad de compras por mes y canal</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Número de facturas de venta positivas, no soles. Una compra pequeña y una mayorista
            cuentan como una cada una.
          </p>
          <SmallChart rows={r.meses} />
          <ComentarioReporte
            titulo={"Cantidad de compras por mes y canal"}
            datos={r.meses}
            nota={
              "b2b y b2c son cantidades de facturas positivas, no soles. Más compras no implica mayor venta."
            }
          />
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold">Crecimiento mensual de ventas por canal</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Mes completo contra el mes calendario anterior. Sin porcentaje cuando no existe base; se
            excluye el mes actual incompleto.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis unit="%" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
                <Line dataKey="b2b" name="B2B" stroke={blue} connectNulls={false} />
                <Line dataKey="b2c" name="B2C" stroke={red} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ComentarioReporte
            titulo={"Crecimiento mensual de ventas por canal"}
            datos={growth}
            nota={
              "Porcentaje respecto al mes calendario anterior; excluye mes actual incompleto; null significa sin base, no 0%."
            }
          />
        </Card>
      </div>
    </section>
  );
}
export function ComparativasPagos({ datos: d, filtros: f }: Props) {
  const [mode, setMode] = useState<"cantidad" | "porcentaje">("porcentaje");
  const rows = comparativasComerciales(d, f).metodos;
  const chartRows = rows.filter(
    (m) => !["efectivo", "liq", "cash"].includes(m.metodo.trim().toLowerCase()),
  );
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Preferencia de pago dentro de cada canal</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "porcentaje" ? "default" : "outline"}
            onClick={() => setMode("porcentaje")}
          >
            Porcentaje
          </Button>
          <Button
            size="sm"
            variant={mode === "cantidad" ? "default" : "outline"}
            onClick={() => setMode("cantidad")}
          >
            Cantidad
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Por fecha de pago. Se cuentan aplicaciones a facturas: un pago repartido puede aparecer
        varias veces. Los porcentajes consideran todos los métodos, incluidos los no mostrados en el
        gráfico. El detalle completo está debajo.
      </p>
      <SmallChart
        rows={chartRows}
        x="metodo"
        percent={mode === "porcentaje"}
        b={mode === "porcentaje" ? "pctB2b" : "b2b"}
        c={mode === "porcentaje" ? "pctB2c" : "b2c"}
      />
      <TablaAdaptable className="w-full text-left text-sm">
        <thead>
          <tr>
            {["Método", "Aplicaciones B2B", "Aplicaciones B2C", "Cobrado B2B", "Cobrado B2C"].map(
              (t) => (
                <th className="p-2" key={t}>
                  {t}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.metodo} className="border-t">
              <td className="p-2">{m.metodo}</td>
              <td className="p-2">{m.b2b}</td>
              <td className="p-2">{m.b2c}</td>
              <td className="p-2">{formatoMoneda(m.importeB2b, d.empresa.moneda)}</td>
              <td className="p-2">{formatoMoneda(m.importeB2c, d.empresa.moneda)}</td>
            </tr>
          ))}
        </tbody>
      </TablaAdaptable>
      <ComentarioReporte
        titulo={"Preferencia de pago dentro de cada canal"}
        datos={{ modo: mode, metodos: rows }}
        nota={
          "Se cuentan aplicaciones de pagos a facturas por fecha de pago. Un pago repartido puede contar varias veces. Los porcentajes incluyen efectivo aunque su barra está oculta; la tabla sí lo incluye."
        }
      />
    </Card>
  );
}
export function ComparativasEntregas({ datos: d, filtros: f }: Props) {
  const orders = d.pedidos.filter(
    (p) =>
      enPeriodo(p.fecha, f.desde, f.hasta) &&
      coincideCanal(p.canal, f.canal) &&
      p.estado !== -1 &&
      p.estado !== 0,
  );
  const pickup = orders.filter((p) => p.modalidad === "recojo");
  const months = new Map<string, { mes: string; on: number; late: number }>();
  for (const p of orders)
    if (p.modalidad === "delivery" && p.fechaEntregaReal && p.entrega && p.fecha) {
      const mes = p.fecha.slice(0, 7),
        r = months.get(mes) ?? { mes, on: 0, late: 0 };
      r[p.fechaEntregaReal <= p.entrega ? "on" : "late"]++;
      months.set(mes, r);
    }
  const rows = [...months.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((r) => ({
      mes: r.mes,
      b2b: (100 * r.on) / (r.on + r.late),
      b2c: (100 * r.late) / (r.on + r.late),
    }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "Recojos en preparación",
            pickup.filter((p) => !p.listoRecojo && !p.fechaEntregaReal).length,
          ],
          [
            "Listos para recoger",
            pickup.filter((p) => p.listoRecojo && !p.fechaEntregaReal).length,
          ],
          ["Retirados", pickup.filter((p) => p.fechaEntregaReal).length],
        ].map(([label, n]) => (
          <Card key={label} className="p-4">
            <p className="text-sm">{label}</p>
            <p className="text-2xl font-bold">{n}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h3 className="font-semibold">Puntualidad de delivery por mes de pedido</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Solo recepciones con fecha prevista. Los pedidos pendientes no cuentan como entregados
          tarde.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="b2b" name="A tiempo" fill="#177961" stackId="p" />
              <Bar dataKey="b2c" name="Con retraso" fill={red} stackId="p" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ComentarioReporte
          titulo={"Puntualidad de delivery por mes de pedido"}
          datos={[...months.values()].sort((a, b) => a.mes.localeCompare(b.mes))}
          nota={
            "on: entregadas a tiempo, late: entregadas tarde. Solo entregas confirmadas con fecha prevista; pendientes y recojos quedan fuera."
          }
        />
      </Card>
    </div>
  );
}
export function ComparativaAlmacenes({ datos: d }: { datos: DatosDolibarr }) {
  const [sku, setSku] = useState(d.productos[0]?.sku ?? "");
  const p = d.productos.find((p) => p.sku === sku);
  const rows = d.almacenes.map((w) => ({
    nombre: w.nombre,
    cantidad: p?.almacenes.find((a) => a.id === w.id)?.cantidad ?? 0,
  }));
  return (
    <Card className="p-4">
      <h3 className="font-semibold">Distribución de un producto entre almacenes</h3>
      <label className="my-3 block text-sm">
        Producto
        <select
          aria-label="Producto para comparar almacenes"
          className="mt-2 block w-full rounded border bg-background p-2"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        >
          {d.productos.map((p) => (
            <option key={p.sku} value={p.sku}>
              {p.sku} · {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        Unidad: {p?.unidad ?? "sin definir"}. Existencias actuales; no se suman productos con
        unidades diferentes.
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="nombre" type="category" width={150} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="cantidad" name="Existencias" fill={blue} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ComentarioReporte
        titulo={"Distribución de un producto entre almacenes"}
        datos={{ sku, producto: p?.nombre, unidad: p?.unidad, almacenes: rows }}
        nota={
          "Existencias actuales del producto seleccionado; no aplica filtro de fechas ni canal. No inventar movimientos o demanda."
        }
      />
    </Card>
  );
}

export function ComparativaProveedores({ datos: d, filtros: f }: Props) {
  const rows = (d.reportes.recepciones ?? []).filter(
    (r) => r.estado > 0 && enPeriodo(r.prevista, f.desde, f.hasta),
  );
  const groups = [...new Set(rows.map((r) => r.proveedor))].map((proveedor) => {
    const rs = rows.filter((r) => r.proveedor === proveedor),
      measurable = rs.filter((r) => r.prevista && r.recibida);
    return {
      proveedor,
      total: rs.length,
      aTiempo: measurable.filter((r) => r.recibida! <= r.prevista!).length,
      tarde: measurable.filter((r) => r.recibida! > r.prevista!).length,
      sinFecha: rs.length - measurable.length,
    };
  });
  return (
    <Card className="p-4">
      <h3 className="font-semibold">Cumplimiento de proveedores</h3>
      <p className="my-3 text-xs text-muted-foreground">
        Por fecha prevista de recepción. Sin fechas suficientes no se calcula puntualidad. Las
        fechas reconstruidas del escenario son supuestos académicos.
      </p>
      <TablaAdaptable className="w-full text-left text-sm">
        <thead>
          <tr>
            {["Proveedor", "Recepciones", "A tiempo", "Con retraso", "Sin fecha suficiente"].map(
              (h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.proveedor} className="border-t">
              <td className="p-2">{g.proveedor}</td>
              <td className="p-2">{g.total}</td>
              <td className="p-2">{g.aTiempo}</td>
              <td className="p-2">{g.tarde}</td>
              <td className="p-2">{g.sinFecha}</td>
            </tr>
          ))}
        </tbody>
      </TablaAdaptable>
      <ComentarioReporte
        titulo={"Cumplimiento de proveedores"}
        datos={groups}
        nota={
          "Por fecha prevista de recepción. Sin fechas suficientes no se calcula puntualidad. Las fechas reconstruidas son supuestos académicos."
        }
      />
    </Card>
  );
}
export function ComparativaProduccion({ datos: d, filtros: f }: Props) {
  const rows = d.reportes.produccion.filter((p) => enPeriodo(p.fecha, f.desde, f.hasta));
  return (
    <section>
      <div className="grid gap-4 sm:grid-cols-4">
        {["Borrador", "Validada", "En curso", "Terminada"].map((s, i) => (
          <Card key={s} className="p-4">
            <p>{s}</p>
            <p className="text-2xl font-bold">{rows.filter((r) => r.estado === i).length}</p>
          </Card>
        ))}
      </div>
      <ComentarioReporte
        titulo={"Estado de las órdenes de fabricación"}
        datos={["Borrador", "Validada", "En curso", "Terminada"].map((estado, i) => ({
          estado,
          cantidad: rows.filter((r) => r.estado === i).length,
        }))}
        nota={"Período por inicio planificado, no por fecha real de finalización."}
      />
    </section>
  );
}
