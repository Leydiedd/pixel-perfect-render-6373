import { nombreCuenta } from "@/lib/payment-presentation";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDolibarr } from "@/context/dolibarr";
import { Pagina, Metrica, Dinero, Vacio } from "@/components/DatosReales";
import { CanalVenta, FiltroCanalVenta } from "@/components/CanalVenta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatoMoneda, formatoFecha } from "@/lib/dolibarr-model";
import { ComparativasCanales, TarjetasCanales } from "@/components/Comparativas";
import { resumenVentas, type FiltroCanal } from "@/lib/sales-model";
export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Panel de control — Bimbo Dolibarr" }] }),
  component: Panel,
});
function Panel() {
  const { datos: d } = useDolibarr();
  const [canal, setCanal] = useState<FiltroCanal>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const invalid = !!desde && !!hasta && desde > hasta;
  const ventas = resumenVentas(d.facturas, desde, hasta, canal);
  return (
    <Pagina titulo="Panel de ventas" descripcion={d.empresa.nombre}>
      <Card className="p-5">
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FiltroCanalVenta value={canal} onChange={setCanal} />
          <label className="space-y-1 text-xs">
            Desde
            <Input
              aria-label="Ventas desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs">
            Hasta
            <Input
              aria-label="Ventas hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            onClick={() => {
              setCanal("todos");
              setDesde("");
              setHasta("");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
        {invalid && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            La fecha inicial debe ser anterior o igual a la fecha final.
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          B2B: compras para negocios. B2C: compras para el hogar. El canal registrado en la venta
          tiene prioridad, aunque una empresa compre para su hogar. Los documentos antiguos se
          clasifican según el cliente actual cuando hay información suficiente.
        </p>
      </Card>
      {!invalid && (
        <>
          <TarjetasCanales datos={d} filtros={{ desde, hasta, canal }} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Metrica
              titulo="Ventas seleccionadas sin IGV"
              valor={<Dinero valor={ventas.total} />}
              detalle={`${ventas.seleccion.length.toLocaleString("es-PE")} documentos · ${desde || hasta ? "Período elegido" : "Todo el historial"}`}
            />
            {ventas.grupos
              .filter((g) => g.canal === "sin_clasificar" && g.documentos > 0)
              .map((g) => (
                <Metrica
                  key={g.canal}
                  titulo={
                    g.canal === "b2b"
                      ? "B2B · Negocios"
                      : g.canal === "b2c"
                        ? "B2C · Hogar"
                        : "Sin clasificar"
                  }
                  valor={<Dinero valor={g.importe} />}
                  detalle={`${g.documentos.toLocaleString("es-PE")} documentos del período${g.segunCliente ? ` · ${g.segunCliente.toLocaleString("es-PE")} según cliente actual` : ""}`}
                />
              ))}
          </div>
          <p className="text-xs text-muted-foreground">
            El filtro de canal se aplica al total seleccionado, al gráfico y a las últimas facturas.
            Importes sin impuestos; incluye notas de crédito con su signo y excluye borradores,
            anuladas y proformas.
          </p>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventas mensuales por canal</CardTitle>
              <p className="text-xs text-muted-foreground">
                Últimos 12 meses con facturación dentro del filtro.{" "}
                {ventas.segunCliente > 0 &&
                  `${ventas.segunCliente.toLocaleString("es-PE")} documentos seleccionados usan la clasificación actual del cliente.`}{" "}
                {ventas.sinFecha > 0 &&
                  `${ventas.sinFecha} documentos sin fecha se incluyen en el total, pero no en el gráfico.`}
              </p>
            </CardHeader>
            <CardContent>
              {!ventas.meses.length ? (
                <Vacio>No hay ventas con fecha para este canal y período.</Vacio>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ventas.meses}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis
                        tickFormatter={(v) =>
                          Math.abs(Number(v)) >= 1000
                            ? `${Math.round(Number(v) / 1000)} mil`
                            : String(v)
                        }
                        width={65}
                      />
                      <Tooltip formatter={(v) => formatoMoneda(Number(v), d.empresa.moneda)} />
                      <Legend />
                      {(canal === "todos" || canal === "b2b") && (
                        <Bar
                          dataKey="b2b"
                          name="B2B · Negocios"
                          fill="#244d85"
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                      {(canal === "todos" || canal === "b2c") && (
                        <Bar
                          dataKey="b2c"
                          name="B2C · Hogar"
                          fill="#16836b"
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                      {(canal === "todos" || canal === "sin_clasificar") && (
                        <Bar
                          dataKey="sin_clasificar"
                          name="Sin clasificar"
                          fill="#8491a1"
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <ComparativasCanales
            datos={d}
            filtros={{ desde, hasta, canal }}
            hoy={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
              new Date(d.fuente.consultadoEn),
            )}
          />
          <Card>
            <CardHeader className="flex-row justify-between">
              <CardTitle className="text-base">Últimas facturas del filtro</CardTitle>
              <Link to="/admin/boletas" className="text-sm text-primary">
                Ver facturas y filtrar
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {!ventas.seleccion.length && (
                <Vacio>No hay ventas que coincidan con estos filtros.</Vacio>
              )}
              {ventas.seleccion.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 text-sm"
                >
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">
                      {f.ref} · {f.cliente}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatoFecha(f.fecha)}</p>
                  </div>
                  <CanalVenta canal={f.canal} fuenteCanal={f.fuenteCanal} />
                  <strong className="shrink-0">
                    <Dinero valor={f.subtotal} />
                    <span className="block text-right text-[10px] font-normal text-muted-foreground">
                      Sin IGV
                    </span>
                  </strong>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica titulo="Productos" valor={d.productos.length} detalle="Total general" />
        <Metrica
          titulo="Terceros"
          valor={d.totales.terceros}
          detalle="Clientes y proveedores · total general"
        />
        <Metrica
          titulo="Pedidos"
          valor={d.pedidos.length.toLocaleString("es-PE")}
          detalle={`${d.pedidos.filter((p) => [1, 2].includes(p.estado)).length} abiertos · total general`}
        />
        <Metrica
          titulo="Expediciones"
          valor={d.expediciones.length.toLocaleString("es-PE")}
          detalle="Total general"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldos de cuentas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {d.bancos.map((b) => (
            <div key={b.id} className="flex justify-between border-b pb-3 text-sm">
              <span>{nombreCuenta(b.nombre)}</span>
              <strong>
                <Dinero valor={b.saldo} moneda={b.moneda} />
              </strong>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Saldos generales calculados a partir de los movimientos registrados; no dependen del
            canal elegido.
          </p>
        </CardContent>
      </Card>
    </Pagina>
  );
}
