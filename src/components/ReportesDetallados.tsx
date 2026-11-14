import { ComentarioReporte } from "@/components/ComentarioReporte";
import { useQueryClient } from "@tanstack/react-query";
import { useSesion } from "@/context/tienda";
import { payloadComentario, solicitarComentario } from "@/lib/report-comment-client";
import { datosExplicacionExportacion } from "@/lib/report-export-comment";
import { useMemo, useState } from "react";
import { Download, FileDown, Search, ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TablaAdaptable } from "./TablaAdaptable";
import { Metrica, Paginacion, Vacio } from "./DatosReales";
import { pagina, formatoMoneda, type DatosDolibarr } from "@/lib/dolibarr-model";
import { canalesVenta } from "@/lib/sales-model";
import { sumarDinero } from "@/lib/reports-model";
import {
  resumenGerencial,
  periodoAnterior,
  canalTexto,
  antiguedadSaldo,
  type ReporteDetalle,
  type FiltrosReporte,
} from "@/lib/report-details";
import {
  descargarCSV,
  descargarPDF,
  formatearCelda,
  type ContextoExportacion,
} from "@/lib/report-export";

export function TablaReporte({
  reporte,
  contexto,
}: {
  reporte: ReporteDetalle;
  contexto: ContextoExportacion;
}) {
  const [busqueda, setBusqueda] = useState(""),
    [numero, setNumero] = useState(1),
    [orden, setOrden] = useState(""),
    [asc, setAsc] = useState(false),
    [exportando, setExportando] = useState(false);
  const filas = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    const data = reporte.filas.filter(
      (f) =>
        !q ||
        Object.values(f).some((v) =>
          String(v ?? "")
            .toLocaleLowerCase("es")
            .includes(q),
        ),
    );
    if (orden)
      data.sort((a, b) => {
        const x = a[orden],
          y = b[orden];
        if (x == null) return y == null ? 0 : 1;
        if (y == null) return -1;
        return (
          (asc ? 1 : -1) *
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), "es", { numeric: true }))
        );
      });
    return data;
  }, [reporte, busqueda, orden, asc]);
  const page = pagina(filas, numero, 15);
  const queryClient = useQueryClient();
  const sesion = useSesion();
  const datosIA = datosExplicacionExportacion(reporte, filas);
  const contextoIA = JSON.stringify({
    empresa: contexto.empresa,
    moneda: contexto.moneda,
    periodo: contexto.periodo,
    canal: contexto.canal,
    busqueda,
    orden,
    asc,
  });
  const notaIA = `${reporte.nota} La explicación abarca todos los resultados filtrados y se incluye en el PDF.`;
  const payloadIA = payloadComentario(reporte.titulo, contextoIA, notaIA, datosIA);
  async function exportar(tipo: "csv" | "pdf") {
    if (exportando || !filas.length) return;
    setExportando(true);
    try {
      const ctx = {
        ...contexto,
        periodo: contexto.periodo + (busqueda ? ` · Búsqueda: ${busqueda}` : ""),
      };
      if (tipo === "csv") descargarCSV(reporte, filas, ctx);
      else {
        const comentario = await queryClient.fetchQuery({
          queryKey: ["comentario-reporte", sesion.data?.sesion?.id, payloadIA],
          queryFn: ({ signal }) => solicitarComentario(payloadIA, signal),
          staleTime: 30 * 60000,
          retry: false,
        });
        await descargarPDF(reporte, filas, ctx, comentario);
      }
      toast.success("Reporte generado", {
        description: `${filas.length} registros. Revisa las descargas de tu navegador.`,
      });
    } catch (error) {
      toast.error("No se pudo completar el reporte con su explicación", {
        description: error instanceof Error ? error.message : "Vuelve a intentarlo.",
      });
    } finally {
      setExportando(false);
    }
  }
  return (
    <Card className="gap-4 overflow-hidden p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{reporte.titulo}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{reporte.nota}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={exportando || !filas.length}
            onClick={() => void exportar("csv")}
          >
            <Download className="size-4" />
            CSV / Excel
          </Button>
          <Button
            variant="outline"
            disabled={exportando || !filas.length}
            onClick={() => void exportar("pdf")}
          >
            <FileDown className="size-4" />
            {exportando ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label={`Buscar en ${reporte.titulo}`}
            className="pl-9"
            placeholder="Buscar en este reporte"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setNumero(1);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filas.length} registros · Las descargas incluyen todos los resultados filtrados.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2 sm:hidden">
        <label className="min-w-0 flex-1 text-xs">
          Ordenar por
          <select
            aria-label="Ordenar reporte por"
            value={orden}
            onChange={(e) => {
              setOrden(e.target.value);
              setNumero(1);
            }}
            className="mt-1 block w-full rounded-md border bg-background px-2 py-2"
          >
            <option value="">Orden original</option>
            {reporte.columnas.map((c) => (
              <option key={c.key} value={c.key}>
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={!orden}
          onClick={() => {
            setAsc(!asc);
            setNumero(1);
          }}
        >
          {asc ? "Ascendente" : "Descendente"}
        </Button>
      </div>
      {filas.length ? (
        <>
          <div className="overflow-x-auto">
            <TablaAdaptable className="w-full text-left text-xs">
              <thead className="bg-navy-soft">
                <tr>
                  {reporte.columnas.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-2"
                      aria-sort={orden === c.key ? (asc ? "ascending" : "descending") : "none"}
                    >
                      <button
                        className="inline-flex items-center gap-1 text-left font-semibold"
                        onClick={() => {
                          setOrden(c.key);
                          setAsc(orden === c.key ? !asc : false);
                          setNumero(1);
                        }}
                      >
                        {c.titulo}
                        <ArrowUpDown className="size-3 shrink-0" aria-hidden="true" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.items.map((f, i) => (
                  <tr key={i}>
                    {reporte.columnas.map((c) => (
                      <td key={c.key} className={`px-3 py-3 ${c.formato ? "tabular-nums" : ""}`}>
                        {formatearCelda(f[c.key] ?? null, c, contexto.moneda)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </TablaAdaptable>
          </div>
          <Paginacion {...page} cambiar={setNumero} />
        </>
      ) : (
        <Vacio>No hay registros para estos filtros.</Vacio>
      )}
      <ComentarioReporte
        titulo={reporte.titulo}
        datos={datosIA}
        contextoExportacion={contextoIA}
        nota={notaIA}
      />
    </Card>
  );
}

export function ResumenEjecutivo({
  datos: d,
  filtros: f,
  hoy,
}: {
  datos: DatosDolibarr;
  filtros: FiltrosReporte;
  hoy: string;
}) {
  const r = resumenGerencial(d, f),
    periodo = periodoAnterior(f.desde, f.hasta),
    prev = periodo ? resumenGerencial(d, { ...f, ...periodo }) : null;
  const variacion = prev && prev.ventas > 0 ? ((r.ventas - prev.ventas) / prev.ventas) * 100 : null;
  const meses = new Map<string, { mes: string; b2b: number; b2c: number; otros: number }>();
  for (const factura of r.facturas) {
    if (!factura.fecha) continue;
    const mes = factura.fecha.slice(0, 7),
      v = meses.get(mes) ?? { mes, b2b: 0, b2c: 0, otros: 0 };
    const k = factura.canal === "b2b" ? "b2b" : factura.canal === "b2c" ? "b2c" : "otros";
    v[k] = sumarDinero([v[k], factura.subtotal]);
    meses.set(mes, v);
  }
  const chart = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  const vencido = sumarDinero(
    r.pendiente.filter((x) => x.vencimiento && x.vencimiento < hoy).map((x) => x.saldo),
  );
  const money = (v: number | null) =>
    v === null ? "Sin datos suficientes" : formatoMoneda(v, d.empresa.moneda);
  return (
    <>
      <div className="rounded-2xl bg-[#20344e] p-5 text-white sm:p-6">
        <p className="text-xs uppercase tracking-widest text-white/70">Vista de dirección</p>
        <h2 className="mt-2 text-xl font-semibold">
          Ventas, rentabilidad y cobros en un solo lugar
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-white/80">
          {canalesVenta.find((c) => c[0] === f.canal)?.[1]} ·{" "}
          {f.desde || "Desde el primer registro"} → {f.hasta || "Hasta el último registro"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          titulo="Ventas netas sin IGV"
          valor={money(r.ventas)}
          detalle={`${r.facturas.length} documentos, incluidas notas de crédito`}
        />
        <Metrica
          titulo="Margen bruto registrado"
          valor={money(r.margen)}
          detalle={
            r.margen !== null && r.ventas > 0
              ? `${((r.margen / r.ventas) * 100).toFixed(1)}% · antes de gastos operativos`
              : "Requiere ventas y costos completos en las líneas"
          }
        />
        <Metrica
          titulo="Cobros en el período"
          valor={money(r.cobros)}
          detalle="Por fecha de pago · con impuestos"
        />
        <Metrica
          titulo="Saldo pendiente actual"
          valor={money(r.saldo)}
          detalle={`${r.pendiente.length} facturas pendientes del período`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica
          titulo="Promedio por factura"
          valor={money(r.ticket)}
          detalle={`${r.facturasTicket} facturas positivas · sin IGV ni notas de crédito`}
        />
        <Metrica
          titulo="Saldo vencido actual"
          valor={money(vencido)}
          detalle={`Según vencimiento al ${hoy}`}
        />
        <Card className="gap-2 p-5">
          <p className="text-xs uppercase text-muted-foreground">Comparación de ventas</p>
          {periodo && prev ? (
            <>
              <p className="text-2xl font-bold">
                {variacion === null ? (
                  "Sin base comparable"
                ) : (
                  <span
                    className={`inline-flex items-center gap-2 ${variacion >= 0 ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {variacion >= 0 ? (
                      <TrendingUp className="size-5" />
                    ) : (
                      <TrendingDown className="size-5" />
                    )}
                    {variacion >= 0 ? "+" : ""}
                    {variacion.toFixed(1)}%
                  </span>
                )}
              </p>
              <p className="text-xs">Anterior: {money(prev.ventas)}</p>
              <p className="text-xs text-muted-foreground">
                {periodo.desde} al {periodo.hasta} · {periodo.dias} días
              </p>
              {variacion === null && (
                <p className="text-xs text-muted-foreground">
                  El período anterior no tiene ventas positivas para calcular un porcentaje.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Elige Desde y Hasta para comparar con el período inmediatamente anterior de igual
              duración.
            </p>
          )}
        </Card>
      </div>
      {chart.length ? (
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">Evolución de ventas por canal</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Importes netos sin IGV, por mes de factura. {r.inferidas} documentos usan el canal del
            cliente actual.
          </p>
          <div className="mt-4 h-80 min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis
                  width={65}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("es-PE", { notation: "compact" }).format(v)
                  }
                />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend />
                <Bar dataKey="b2b" name="B2B" fill="#20344e" />
                <Bar dataKey="b2c" name="B2C" fill="#c52d36" />
                <Bar dataKey="otros" name="Sin clasificar" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ComentarioReporte
            titulo={"Evolución de ventas por canal"}
            datos={chart}
            nota={`Ventas netas sin IGV por mes de factura. ${r.inferidas} documentos usan el canal actual del cliente. El mes actual puede estar incompleto.`}
          />
        </Card>
      ) : (
        <Vacio>No hay ventas con fecha registrada en esta selección.</Vacio>
      )}
    </>
  );
}

export function AntiguedadCobranza({
  datos,
  filtros,
  hoy,
}: {
  datos: DatosDolibarr;
  filtros: FiltrosReporte;
  hoy: string;
}) {
  const r = resumenGerencial(datos, filtros);
  const tramos = [
    "Por vencer / vence hoy",
    "1–30 días",
    "31–60 días",
    "61–90 días",
    "Más de 90 días",
    "Sin vencimiento",
  ];
  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tramos.map((tramo) => {
          const rows = r.pendiente.filter(
            (f) => antiguedadSaldo(f.vencimiento, hoy).tramo === tramo,
          );
          return (
            <Metrica
              key={tramo}
              titulo={tramo}
              valor={formatoMoneda(sumarDinero(rows.map((f) => f.saldo)), datos.empresa.moneda)}
              detalle={`${rows.length} facturas · saldo actual`}
            />
          );
        })}
      </div>
      <ComentarioReporte
        titulo={"Antigüedad de la cobranza"}
        datos={tramos.map((tramo) => {
          const rows = r.pendiente.filter(
            (f) => antiguedadSaldo(f.vencimiento, hoy).tramo === tramo,
          );
          return { tramo, facturas: rows.length, saldo: sumarDinero(rows.map((f) => f.saldo)) };
        })}
        nota={`Saldo pendiente actual de facturas del período; vencimiento evaluado al ${hoy}. No representa el saldo histórico al cierre.`}
      />
    </section>
  );
}
