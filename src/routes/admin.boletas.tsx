import { TablaAdaptable } from "@/components/TablaAdaptable";
import { documentoNotificado } from "@/lib/admin-notifications-model";
import { agruparMetodos } from "@/lib/payment-presentation";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CanalVenta, FiltroCanalVenta } from "@/components/CanalVenta";
import { coincideCanal, type FiltroCanal } from "@/lib/sales-model";
import { Download } from "lucide-react";
import { useDolibarr } from "@/context/dolibarr";
import { Pagina, Vacio, Dinero, Paginacion, Estado } from "@/components/DatosReales";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PagarFactura } from "@/components/PagarFactura";
import { HistorialFactura } from "@/components/HistorialFactura";
import {
  estadoFactura,
  tipoFactura,
  formatoFecha,
  filtrarFacturas,
  pagina,
} from "@/lib/dolibarr-model";
export const Route = createFileRoute("/admin/boletas")({
  validateSearch: (search: Record<string, unknown>): { factura?: number | undefined } => ({
    factura: documentoNotificado(search["factura"]),
  }),
  head: () => ({ meta: [{ title: "Facturas de Dolibarr — Bimbo" }] }),
  component: Facturas,
});
function Facturas() {
  const { factura: documentoId } = Route.useSearch();
  const { datos } = useDolibarr();
  const [canal, setCanal] = useState<FiltroCanal>("todos");
  const [consulta, setConsulta] = useState("");
  const [metodoPago, setMetodoPago] = useState("todos");
  const [estado, setEstado] = useState("Todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [numero, setNumero] = useState(1);
  const [pagar, setPagar] = useState<number | null>(null);
  const [historial, setHistorial] = useState<number | null>(null);
  const [vista, setVista] = useState<"pagos" | "pdf">("pagos");
  useEffect(() => {
    setConsulta("");
    setEstado("Todos");
    setCanal("todos");
    setNumero(1);
    setMetodoPago("todos");
    setDesde("");
    setHasta("");
  }, [documentoId]);
  const result = filtrarFacturas(datos.facturas, consulta, estado, desde, hasta).filter(
    (f) =>
      (!documentoId || f.id === documentoId) &&
      coincideCanal(f.canal, canal) &&
      (metodoPago === "todos" || f.pagosResumen.some((p) => p.codigo === metodoPago)),
  );
  const page = pagina(result, numero);
  const metodos = [
    ...new Map(
      datos.facturas.flatMap((f) => f.pagosResumen).map((p) => [p.codigo, p.medio]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "es"));
  const totalPagado =
    result
      .flatMap((f) => f.pagosResumen)
      .filter((p) => metodoPago === "todos" || p.codigo === metodoPago)
      .reduce((n, p) => n + Math.round(p.importe * 100), 0) / 100;
  const change = (fn: (s: string) => void, value: string) => {
    fn(value);
    setNumero(1);
  };
  return (
    <Pagina
      titulo="Facturas de venta"
      descripcion={`${datos.facturas.length.toLocaleString("es-PE")} documentos registrados. Importes con impuestos.`}
    >
      {documentoId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-blue-50 p-3 text-sm">
          <span>Factura abierta desde una notificación</span>
          <Link to="/admin/boletas" search={{}} className="font-medium underline">
            Ver todas las facturas
          </Link>
        </div>
      )}
      <PagarFactura facturaId={pagar} cerrar={() => setPagar(null)} />
      <HistorialFactura
        facturaId={historial}
        vista={vista}
        cambiarVista={setVista}
        cerrar={() => setHistorial(null)}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs">
          Buscar
          <Input
            aria-label="Buscar facturas"
            placeholder="Referencia o cliente"
            value={consulta}
            onChange={(e) => change(setConsulta, e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Estado
          <select
            aria-label="Estado de factura"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={estado}
            onChange={(e) => change(setEstado, e.target.value)}
          >
            {["Todos", "Pagada", "Pendiente", "Borrador", "Cerrada", "Anulada"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Desde
          <Input type="date" value={desde} onChange={(e) => change(setDesde, e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          Hasta
          <Input type="date" value={hasta} onChange={(e) => change(setHasta, e.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          Método de pago
          <select
            aria-label="Método de pago"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={metodoPago}
            onChange={(e) => {
              setMetodoPago(e.target.value);
              setNumero(1);
            }}
          >
            <option value="todos">Todos los métodos</option>
            {metodos.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Card className="gap-1 p-4">
        <p className="text-xs text-muted-foreground">Pagos registrados</p>
        <strong className="text-xl">
          <Dinero valor={totalPagado} />
        </strong>
        <p className="text-xs text-muted-foreground">
          Importes aplicados a las facturas filtradas. Los pagos anulados no se incluyen.
        </p>
      </Card>
      <FiltroCanalVenta
        value={canal}
        onChange={(v) => {
          setCanal(v);
          setNumero(1);
        }}
      />
      <p className="text-xs text-muted-foreground">
        El canal registrado en la venta tiene prioridad. “Según cliente actual” indica una
        clasificación de documentos sin canal guardado.
      </p>
      <p className="text-sm">
        {result.length.toLocaleString("es-PE")} resultados · Total de facturas:{" "}
        <strong>
          <Dinero valor={result.reduce((n, f) => n + f.total, 0)} />
        </strong>
      </p>
      {!result.length ? (
        <Vacio>No hay facturas que coincidan con estos filtros.</Vacio>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <TablaAdaptable className="w-full text-left text-sm">
              <thead className="bg-navy-soft text-xs">
                <tr>
                  {[
                    "Documento",
                    "Cliente",
                    "Canal",
                    "Fecha",
                    "Total",
                    "Saldo pendiente",
                    "Métodos de pago",
                    "Estado",
                    "PDF",
                    "Pago",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.items.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary hover:underline py-2"
                        aria-label={"Abrir factura " + f.ref}
                        onClick={() => {
                          setVista(f.pdf ? "pdf" : "pagos");
                          setHistorial(f.id);
                        }}
                      >
                        {f.ref}
                      </button>
                      <p className="text-xs text-muted-foreground">{tipoFactura(f.tipo)}</p>
                    </td>
                    <td className="px-4 py-3">{f.cliente}</td>
                    <td className="px-4 py-3">
                      <CanalVenta canal={f.canal} fuenteCanal={f.fuenteCanal} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatoFecha(f.fecha)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Dinero valor={f.total} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Dinero valor={f.saldo} />
                    </td>
                    <td className="min-w-52 px-4 py-3">
                      {f.pagosResumen.length ? (
                        <div className="space-y-2">
                          {agruparMetodos(f.pagosResumen).map((p) => (
                            <div key={p.codigo}>
                              <p className="text-xs font-medium">
                                {p.medio} · <Dinero valor={p.importe} />
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin pagos registrados</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Estado>{estadoFactura(f)}</Estado>
                    </td>
                    <td className="px-4 py-3">
                      {f.pdf ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`PDF ${f.ref}`}
                          onClick={() => {
                            setVista("pdf");
                            setHistorial(f.id);
                          }}
                        >
                          <Download className="size-4" />
                          PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No disponible</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mb-1"
                        aria-label={`Historial de pagos ${f.ref}`}
                        onClick={() => {
                          setVista("pagos");
                          setHistorial(f.id);
                        }}
                      >
                        Ver historial
                      </Button>
                      {f.pagoPermitido ? (
                        <Button variant="outline" size="sm" onClick={() => setPagar(f.id)}>
                          Registrar pago
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {f.pagada ? "Pagada" : "No disponible"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablaAdaptable>
          </div>
          <Paginacion {...page} cambiar={setNumero} />
        </Card>
      )}
    </Pagina>
  );
}
