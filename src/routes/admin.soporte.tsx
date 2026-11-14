import { ComentarioReporte, ContextoComentarios } from "@/components/ComentarioReporte";
import { DashboardGananciaNeta } from "@/components/DashboardGananciaNeta";
import { filtrarMeses, reporteNeto } from "@/lib/net-profit";
import { DashboardClientes } from "@/components/DashboardClientes";
import { DashboardProductos } from "@/components/DashboardProductos";
import {
  TablaReporte,
  ResumenEjecutivo,
  AntiguedadCobranza,
} from "@/components/ReportesDetallados";
import { construirDetalles, resumenGerencial } from "@/lib/report-details";
import { canalesVenta } from "@/lib/sales-model";
import { TablaAdaptable } from "@/components/TablaAdaptable";
import { ReporteEntregas } from "@/components/ReporteEntregas";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ComparativasCanales,
  TarjetasCanales,
  ComparativasPagos,
  ComparativasEntregas,
  ComparativaAlmacenes,
  ComparativaProveedores,
  ComparativaProduccion,
} from "@/components/Comparativas";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDolibarr } from "@/context/dolibarr";
import { Pagina, Metrica, Dinero, Vacio, EnDolibarr } from "@/components/DatosReales";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FiltroCanalVenta } from "@/components/CanalVenta";
import { coincideCanal, type FiltroCanal } from "@/lib/sales-model";
import { formatoFecha, formatoMoneda } from "@/lib/dolibarr-model";
import { enPeriodo, sumarDinero, agruparImportes, resumenEntregas } from "@/lib/reports-model";
export const Route = createFileRoute("/admin/soporte")({
  head: () => ({ meta: [{ title: "Dashboards y reportes — Bimbo" }] }),
  component: Reportes,
});
const secciones = [
  "Resumen",
  "Productos",
  "Clientes",
  "Pagos",
  "Ventas",
  "Cobranza",
  "Entregas",
  "Inventario",
  "Compras",
  "Producción",
  "Ganancia neta",
  "Ganancia por mes",
] as const;
function Grafico({
  titulo,
  datos,
  moneda = true,
}: {
  titulo: string;
  datos: { nombre: string; importe: number }[];
  moneda?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {datos.length ? (
          <div className="h-72 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ bottom: 30, left: 0, right: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  angle={-20}
                  textAnchor="end"
                  tickFormatter={(v) =>
                    String(v).length > 20 ? String(v).slice(0, 18) + "…" : String(v)
                  }
                />
                <YAxis
                  allowDecimals={moneda}
                  tick={{ fontSize: 10 }}
                  width={65}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("es-PE", { notation: "compact" }).format(v)
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    moneda ? formatoMoneda(Number(v)) : Number(v).toLocaleString("es-PE")
                  }
                  labelFormatter={(v) => String(v)}
                />
                <Bar
                  name={moneda ? "Importe" : "Cantidad"}
                  dataKey="importe"
                  fill="#20344e"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Vacio>Sin registros para esta selección.</Vacio>
        )}
        <ComentarioReporte
          titulo={titulo}
          datos={datos}
          nota={
            moneda
              ? "Importes en moneda del reporte; consulta el título para distinguir ventas, compras y cobros."
              : "Cantidad de registros, no importe monetario."
          }
        />
      </CardContent>
    </Card>
  );
}
function Ranking({
  titulo,
  datos,
}: {
  titulo: string;
  datos: { nombre: string; importe: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {datos.length ? (
          datos.slice(0, 8).map((r, i) => (
            <div
              key={r.nombre}
              className="flex items-center justify-between gap-4 border-b pb-3 text-sm"
            >
              <span>
                <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                {r.nombre}
              </span>
              <strong className="whitespace-nowrap">
                <Dinero valor={r.importe} />
              </strong>
            </div>
          ))
        ) : (
          <Vacio>Sin registros para esta selección.</Vacio>
        )}
        <ComentarioReporte
          titulo={titulo}
          datos={datos.slice(0, 8)}
          nota={"Top 8 por importe; solo se interpreta el ranking mostrado, no el total."}
        />
      </CardContent>
    </Card>
  );
}
function Reportes() {
  const { datos: d } = useDolibarr();
  const [tab, setTab] = useState<(typeof secciones)[number]>("Resumen");
  const esNeto = tab === "Ganancia neta" || tab === "Ganancia por mes";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(d.fuente.consultadoEn),
  );
  const mesCompleto = (d.reportes.gananciaNeta || [])
    .filter((r) => r.mes < today.slice(0, 7) && r.estado === "Estimación académica")
    .map((r) => r.mes)
    .sort()
    .at(-1);
  const baseCierre = new Date((mesCompleto || today.slice(0, 7)) + "-01T12:00:00Z");
  const cierreCompleto = new Date(Date.UTC(
    baseCierre.getUTCFullYear(), baseCierre.getUTCMonth() + (mesCompleto ? 1 : 0), 0, 12,
  )).toISOString().slice(0, 10);
  const [desdeGeneral, setDesdeGeneral] = useState("");
  const [hastaGeneral, setHastaGeneral] = useState("");
  const [desdeNeto, setDesdeNeto] = useState("");
  const [hastaNeto, setHastaNeto] = useState<string | null>(null);
  const desde = esNeto ? desdeNeto : desdeGeneral;
  const hasta = esNeto ? (hastaNeto ?? cierreCompleto) : hastaGeneral;
  const setDesde = esNeto ? setDesdeNeto : setDesdeGeneral;
  const setHasta = esNeto ? setHastaNeto : setHastaGeneral;
  const [canal, setCanal] = useState<FiltroCanal>("todos");
  const invalid = !!desde && !!hasta && desde > hasta;
  const isCommercial = [
    "Resumen",
    "Productos",
    "Clientes",
    "Pagos",
    "Ventas",
    "Cobranza",
    "Entregas",
  ].includes(tab);
  const resumen = resumenGerencial(d, { desde, hasta, canal });
  const invoices = resumen.facturas;
  const lines = resumen.lineas;
  const sales = resumen.ventas;
  const margin = resumen.margen;
  const monthly = agruparImportes(
    invoices,
    (f) => f.fecha?.slice(0, 7) || "Sin fecha",
    (f) => f.subtotal,
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const customers = agruparImportes(
    invoices,
    (f) => f.cliente,
    (f) => f.subtotal,
  );
  const products = agruparImportes(
    lines,
    (l) => `${l.sku} · ${l.producto}`,
    (l) => l.venta,
  );
  const payments = resumen.pagos;
  const paymentMethods = agruparImportes(
    payments,
    (p) => p.metodo,
    (p) => p.importe,
  );
  const collected = sumarDinero(payments.map((p) => p.importe));
  const receivables = resumen.pendiente;

  const overdue = receivables.filter((f) => f.vencimiento && f.vencimiento < today);
  const orders = d.pedidos
    .filter((p) => p.modalidad !== "recojo")
    .filter((p) => enPeriodo(p.fecha, desde, hasta) && coincideCanal(p.canal, canal));
  const delivery = resumenEntregas(orders, today);
  const delivered = orders
    .filter((p) => p.fechaEntregaReal && [1, 2, 3].includes(p.estado))
    .sort((a, b) => b.fechaEntregaReal!.localeCompare(a.fechaEntregaReal!));
  const purchases = d.reportes.compras.filter(
    (f) => [1, 2].includes(f.estado) && enPeriodo(f.fecha, desde, hasta),
  );
  const buying = sumarDinero(purchases.map((f) => f.total));
  const suppliers = agruparImportes(
    purchases,
    (f) => f.proveedor,
    (f) => f.total,
  );
  const purchaseMonths = agruparImportes(
    purchases,
    (f) => f.fecha?.slice(0, 7) || "Sin fecha",
    (f) => f.total,
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const manufacturing = d.reportes.produccion.filter(
    (p) => p.estado !== -1 && enPeriodo(p.fecha, desde, hasta),
  );
  const manufactured = manufacturing.filter((p) => p.estado === 3);
  const productionMonths = agruparImportes(
    manufactured,
    (p) => p.fecha?.slice(0, 7) || "Sin fecha",
    () => 1,
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const stock = d.productos.filter((p) => p.gestionaStock);
  const low = stock.filter((p) => p.umbral !== null && p.umbral > 0 && p.stock < p.umbral);
  const noMinimum = stock.filter((p) => !p.umbral || p.umbral <= 0);
  const empty = stock.filter((p) => p.enVenta && p.stock <= 0);
  const filtros = { desde, hasta, canal };
  const detalles = construirDetalles(d, filtros, today);

  const mesesNetos = filtrarMeses(d.reportes.gananciaNeta || [], desde, hasta);
  const detalle = esNeto ? reporteNeto(mesesNetos, tab === "Ganancia por mes") : detalles[tab]!;
  const contexto = {
    empresa: d.empresa.nombre,
    moneda: d.empresa.moneda,
    periodo:
      tab === "Inventario"
        ? "Existencias actuales"
        : esNeto
          ? `${desde.slice(0, 7) || "Inicio del historial"} al ${hasta.slice(0, 7) || "Último mes"} · por meses completos / corte provisional`
          : (desde || "Inicio del historial") + " al " + (hasta || "Último registro"),
    canal: isCommercial ? canalesVenta.find((c) => c[0] === canal)![1] : "No aplica",
    consultado: new Date(d.fuente.consultadoEn).toLocaleString("es-PE", {
      timeZone: "America/Lima",
    }),
  };
  function elegirPeriodo(tipo: "mes" | "anterior" | "ultimo") {
    const fecha =
      tipo === "ultimo"
        ? d.facturas
            .filter((f) => f.fecha && f.estado !== 0 && f.estado !== 3 && f.tipo !== 4)
            .map((f) => f.fecha!)
            .sort()
            .at(-1) || today
        : today;
    const base = new Date(fecha.slice(0, 7) + "-01T12:00:00Z");
    if (tipo === "anterior") base.setUTCMonth(base.getUTCMonth() - 1);
    setDesde(base.toISOString().slice(0, 10));
    const fin = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 12))
      .toISOString()
      .slice(0, 10);
    setHasta(tipo === "mes" ? today : fin);
  }
  return (
    <ContextoComentarios.Provider
      value={`Período: ${tab === "Inventario" ? "Existencias actuales, sin filtro de período" : contexto.periodo}. Canal: ${contexto.canal}. Moneda: ${contexto.moneda}. Fecha de referencia: ${today}. No hay filtro geográfico; no atribuir ventas a una ciudad.`}
    >
      <Pagina
        titulo="Dashboards y reportes"
        descripcion="Ventas, cobros y operación conectados a Dolibarr."
      >
        <label className="block space-y-2 text-sm font-medium sm:hidden">
          Reporte a consultar
          <select
            aria-label="Reporte a consultar"
            value={tab}
            onChange={(e) => setTab(e.target.value as (typeof secciones)[number])}
            className="block w-full rounded-lg border bg-white px-3 py-2"
          >
            {secciones.map((s) => (
              <option key={s} value={s}>
                {s === "Resumen" ? "Resumen ejecutivo" : s}
              </option>
            ))}
          </select>
        </label>
        <div className="hidden flex-wrap gap-2 sm:flex" role="tablist" aria-label="Dashboards">
          {secciones.map((s) => (
            <Button
              key={s}
              role="tab"
              aria-selected={tab === s}
              variant={tab === s ? "default" : "outline"}
              onClick={() => setTab(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Datos de Dolibarr · Consulta: {contexto.consultado} (Lima) · Moneda: {contexto.moneda}
        </p>
        {tab !== "Inventario" && (
          <Card className="p-4">
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Períodos rápidos">
              <Button size="sm" variant="outline" onClick={() => elegirPeriodo("mes")}>
                Este mes
              </Button>
              <Button size="sm" variant="outline" onClick={() => elegirPeriodo("anterior")}>
                Mes anterior
              </Button>
              <Button size="sm" variant="outline" onClick={() => elegirPeriodo("ultimo")}>
                Último mes con ventas
              </Button>
            </div>
            <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs">
                Desde
                <Input
                  aria-label="Reportes desde"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Hasta
                <Input
                  aria-label="Reportes hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </label>
              {isCommercial ? (
                <FiltroCanalVenta value={canal} onChange={setCanal} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {esNeto
                    ? "Resultado global de ambos canales. Se incluyen los meses seleccionados completos o hasta el corte provisional."
                    : tab === "Compras"
                      ? "Período por fecha de factura de proveedor."
                      : "Período por inicio planificado de la orden."}
                </p>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setDesde("");
                  if (esNeto) setHastaNeto(null);
                  else setHastaGeneral("");
                  setCanal("todos");
                }}
              >
                {esNeto ? "Meses completos" : "Todo el historial"}
              </Button>
            </div>
          </Card>
        )}
        {esNeto && hastaNeto === null && (
          <p className="text-xs text-muted-foreground">
            Mostrando meses completos hasta {formatoFecha(cierreCompleto)}. Para consultar el mes
            actual, pulsa «Este mes» o cambia las fechas.
          </p>
        )}
        {isCommercial && (!hasta || hasta >= today.slice(0, 7) + "-01") && (
          <p className="text-xs text-amber-800">
            El mes actual está incompleto. Para comparar meses completos selecciona un cierre
            anterior.
          </p>
        )}
        {invalid && tab !== "Inventario" ? (
          <p role="alert" className="rounded-lg bg-amber-50 p-4">
            La fecha inicial debe ser anterior o igual a la final.
          </p>
        ) : (
          <>
            {(["Resumen", "Ventas"] as string[]).includes(tab) && (
              <TarjetasCanales datos={d} filtros={filtros} />
            )}
            {tab === "Ganancia neta" && <DashboardGananciaNeta rows={mesesNetos} />}
            {tab === "Productos" && (
              <DashboardProductos filas={detalle.filas} moneda={d.empresa.moneda} />
            )}
            {tab === "Clientes" && <DashboardClientes datos={d} filtros={filtros} />}
            {tab === "Resumen" && <ResumenEjecutivo datos={d} filtros={filtros} hoy={today} />}
            {tab === "Cobranza" && <AntiguedadCobranza datos={d} filtros={filtros} hoy={today} />}
            {tab === "Ventas" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metrica titulo="Ventas sin IGV" valor={<Dinero valor={sales} />} />
                  <Metrica
                    titulo="Margen bruto registrado"
                    valor={margin === null ? "Sin datos suficientes" : <Dinero valor={margin} />}
                    detalle={
                      margin !== null && sales > 0
                        ? `${((margin / sales) * 100).toFixed(1)}% de las ventas`
                        : "Revisar costos de las líneas"
                    }
                  />
                  <Metrica titulo="Facturas" valor={invoices.length.toLocaleString("es-PE")} />
                  <Metrica titulo="Clientes con compras" valor={customers.length} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Por fecha de factura. Excluye borradores, anuladas y proformas; conserva el signo
                  de las notas de crédito. El margen usa el costo de las líneas; no incluye gastos
                  operativos. {invoices.filter((f) => f.fuenteCanal === "cliente").length}{" "}
                  documentos tienen canal inferido del cliente actual.
                </p>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Grafico titulo="Ventas por mes" datos={monthly} />
                  <Grafico
                    titulo="Ventas por canal"
                    datos={agruparImportes(
                      invoices,
                      (f) =>
                        f.canal === "b2b"
                          ? "B2B · Negocios"
                          : f.canal === "b2c"
                            ? "B2C · Hogar"
                            : "Sin clasificar",
                      (f) => f.subtotal,
                    )}
                  />
                  <Ranking titulo="Clientes con mayores ventas" datos={customers} />
                  <Ranking titulo="Productos con mayores ventas" datos={products} />
                </div>
              </>
            )}
            {tab === "Cobranza" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metrica titulo="Cobros en el período" valor={<Dinero valor={collected} />} />
                  <Metrica
                    titulo="Saldo pendiente"
                    valor={<Dinero valor={sumarDinero(receivables.map((f) => f.saldo))} />}
                  />
                  <Metrica
                    titulo="Saldo vencido"
                    valor={<Dinero valor={sumarDinero(overdue.map((f) => f.saldo))} />}
                  />
                  <Metrica titulo="Facturas pendientes" valor={receivables.length} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cobros por fecha de pago, excluyendo pagos anulados. Saldos actuales de las
                  facturas emitidas en el período. Los pagos repartidos se contabilizan por el
                  importe aplicado a cada factura.
                </p>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Grafico
                    titulo="Cobros por método"
                    datos={paymentMethods.filter(
                      (m) => !["efectivo", "liq", "cash"].includes(m.nombre.trim().toLowerCase()),
                    )}
                  />
                  <Ranking
                    titulo="Clientes con saldo pendiente"
                    datos={agruparImportes(
                      receivables,
                      (f) => f.cliente,
                      (f) => f.saldo,
                    )}
                  />
                </div>
                <Button asChild variant="outline">
                  <Link to="/admin/boletas">Ver facturas e historial de pagos</Link>
                </Button>
              </>
            )}
            {tab === "Entregas" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metrica titulo="Pedidos vigentes" valor={delivery.total} />
                  <Metrica titulo="Entregas confirmadas" valor={delivery.entregados} />
                  <Metrica titulo="Sin confirmación" valor={delivery.sinConfirmar} />
                  <Metrica
                    titulo="Puntualidad de entregas"
                    valor={
                      delivery.medibles
                        ? `${((delivery.aTiempo / delivery.medibles) * 100).toFixed(1)}%`
                        : "Sin datos"
                    }
                    detalle={`${delivery.medibles} entregas con fecha prevista y real`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Pedidos por fecha de creación. La salida de almacén no confirma recepción del
                  cliente. Los pedidos históricos sin fecha real permanecen «Sin confirmación». El
                  cumplimiento solo considera entregas con ambas fechas.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metrica titulo="Entregadas a tiempo" valor={delivery.aTiempo} />
                  <Metrica titulo="Entregadas con retraso" valor={delivery.conRetraso} />
                  <Metrica
                    titulo="Entregadas sin fecha prevista"
                    valor={delivery.sinFechaPrevista}
                  />
                  <Metrica titulo="Vencidas sin confirmar" valor={delivery.vencidos} />
                </div>
                <Grafico
                  titulo="Puntualidad de las entregas confirmadas"
                  moneda={false}
                  datos={[
                    { nombre: "A tiempo", importe: delivery.aTiempo },
                    { nombre: "Con retraso", importe: delivery.conRetraso },
                    { nombre: "Sin fecha prevista", importe: delivery.sinFechaPrevista },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  Estos indicadores consideran pedidos con delivery; los recojos en tienda se
                  consultan en Pedidos. Recibir el pedido el día previsto cuenta como entrega a
                  tiempo. El retraso se calcula en días calendario. Los pedidos vencidos sin
                  recepción confirmada se muestran aparte; no cuentan como entregas tardías.
                </p>
                <ReporteEntregas pedidos={orders} hoy={today} />
                <Button asChild>
                  <Link to="/admin/pedido">Confirmar entregas en Pedidos</Link>
                </Button>
              </>
            )}
            {tab === "Inventario" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metrica titulo="Productos con stock gestionado" valor={stock.length} />
                  <Metrica titulo="En venta sin existencias" valor={empty.length} />
                  <Metrica
                    titulo="Por debajo del mínimo"
                    valor={low.length}
                    detalle="Solo productos con mínimo definido"
                  />
                  <Metrica titulo="Sin mínimo configurado" valor={noMinimum.length} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Existencias actuales, sin filtro de período ni canal. Las cantidades se consultan
                  por producto y unidad; no se suman insumos de unidades diferentes.
                </p>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Grafico
                    titulo="Referencias con registro por almacén"
                    moneda={false}
                    datos={d.almacenes.map((a) => ({ nombre: a.nombre, importe: a.referencias }))}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Productos que requieren atención</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[...new Map([...empty, ...low].map((p) => [p.id, p])).values()]
                        .slice(0, 12)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="flex justify-between gap-3 border-b pb-2 text-sm"
                          >
                            <span>
                              {p.sku} · {p.nombre}
                            </span>
                            <strong>
                              {p.stock} {p.unidad}
                            </strong>
                          </div>
                        ))}
                      {!empty.length && !low.length && (
                        <Vacio>Sin alertas según los mínimos configurados.</Vacio>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {noMinimum.length} productos necesitan un mínimo para evaluar reposición.
                      </p>
                      <ComentarioReporte
                        titulo={"Alertas de reposición"}
                        datos={{
                          sinStock: empty.length,
                          bajoMinimo: low.length,
                          sinMinimoConfigurado: noMinimum.length,
                        }}
                        nota={
                          "Inventario actual. No implica ventas perdidas ni roturas históricas."
                        }
                      />
                    </CardContent>
                  </Card>
                </div>
                <Button asChild variant="outline">
                  <Link to="/admin/inventario">Ver inventario</Link>
                </Button>
              </>
            )}
            {tab === "Compras" && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Metrica titulo="Compras sin IGV" valor={<Dinero valor={buying} />} />
                  <Metrica titulo="Facturas de proveedor" valor={purchases.length} />
                  <Metrica titulo="Proveedores con compras" valor={suppliers.length} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Facturas de proveedores validadas, por fecha de emisión. No se mezclan pedidos de
                  compra con facturación.
                </p>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Grafico titulo="Compras por mes" datos={purchaseMonths} />
                  <Ranking titulo="Principales proveedores" datos={suppliers} />
                </div>
                <EnDolibarr ruta="fourn/facture/list.php">
                  Ver facturas de proveedores en Dolibarr
                </EnDolibarr>
              </>
            )}
            {tab === "Producción" && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Metrica titulo="Órdenes de fabricación" valor={manufacturing.length} />
                  <Metrica titulo="Órdenes terminadas" valor={manufactured.length} />
                  <Metrica
                    titulo="Productos fabricados"
                    valor={
                      new Set(manufactured.filter((p) => p.producido > 0).map((p) => p.sku)).size
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Por inicio planificado; las cantidades realizadas provienen del registro de
                  producción. No se infieren tiempos de máquina ni mermas a partir de la fecha de
                  importación.
                </p>
                <Grafico
                  titulo="Órdenes terminadas por mes planificado"
                  moneda={false}
                  datos={productionMonths}
                />
                <Card className="overflow-x-auto p-4">
                  <h2 className="mb-3 font-semibold">
                    Producción prevista y realizada por producto
                  </h2>
                  <TablaAdaptable className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        {["Producto", "Unidad", "Previsto", "Producido", "Diferencia"].map((h) => (
                          <th key={h} className="p-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...new Set(manufacturing.map((p) => p.sku))].map((sku) => {
                        const rows = manufacturing.filter((p) => p.sku === sku);
                        const planned = rows.reduce((n, p) => n + p.previsto, 0);
                        const actual = rows.reduce((n, p) => n + p.producido, 0);
                        return (
                          <tr key={sku} className="border-t">
                            <td className="p-3">
                              {sku} · {rows[0]!.producto}
                            </td>
                            <td className="p-3">{rows[0]!.unidad}</td>
                            <td className="p-3">{planned.toLocaleString("es-PE")}</td>
                            <td className="p-3">{actual.toLocaleString("es-PE")}</td>
                            <td className="p-3">{(actual - planned).toLocaleString("es-PE")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TablaAdaptable>
                  {!manufacturing.length && <Vacio>Sin órdenes en este período.</Vacio>}
                  <ComentarioReporte
                    titulo={"Producción prevista y realizada por producto"}
                    datos={[...new Set(manufacturing.map((p) => p.sku))].map((sku) => {
                      const rs = manufacturing.filter((p) => p.sku === sku);
                      return {
                        sku,
                        producto: rs[0]?.producto,
                        unidad: rs[0]?.unidad,
                        previsto: rs.reduce((n, p) => n + p.previsto, 0),
                        producido: rs.reduce((n, p) => n + p.producido, 0),
                      };
                    })}
                    nota={
                      "Cantidades por producto; no sumarlas entre unidades distintas. No inferir merma ni tiempos de máquina."
                    }
                  />
                </Card>
                <EnDolibarr ruta="mrp/mo_list.php">
                  Ver órdenes de fabricación en Dolibarr
                </EnDolibarr>
              </>
            )}
            {(["Resumen", "Ventas"] as string[]).includes(tab) && (
              <ComparativasCanales datos={d} filtros={filtros} hoy={today} />
            )}
            {(["Pagos", "Cobranza"] as string[]).includes(tab) && (
              <ComparativasPagos datos={d} filtros={filtros} hoy={today} />
            )}
            {tab === "Entregas" && <ComparativasEntregas datos={d} filtros={filtros} hoy={today} />}
            {tab === "Inventario" && <ComparativaAlmacenes datos={d} />}
            {tab === "Compras" && (
              <ComparativaProveedores datos={d} filtros={filtros} hoy={today} />
            )}
            {tab === "Producción" && (
              <ComparativaProduccion datos={d} filtros={filtros} hoy={today} />
            )}
            <TablaReporte
              key={`${tab}-${desde}-${hasta}-${canal}`}
              reporte={detalle}
              contexto={contexto}
            />
          </>
        )}
      </Pagina>
    </ContextoComentarios.Provider>
  );
}
