import { ProductoImagen } from "@/components/ProductoImagen";
import { TablaAdaptable } from "@/components/TablaAdaptable";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { toast } from "sonner";
import { DetallePedido } from "@/components/DetallePedido";
import { GestionarRecojo } from "@/components/GestionarRecojo";
import { documentoNotificado } from "@/lib/admin-notifications-model";
import { ProgramarEntrega } from "@/components/ProgramarEntrega";
import { ConfirmarEntrega } from "@/components/ConfirmarEntrega";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CanalVenta, FiltroCanalVenta } from "@/components/CanalVenta";
import { coincideCanal, type FiltroCanal } from "@/lib/sales-model";
import { useState, useEffect } from "react";
import { useDolibarr } from "@/context/dolibarr";
import { usePedido } from "@/context/pedido";
import { Pagina, Vacio, Dinero, Paginacion, Estado, EnDolibarr } from "@/components/DatosReales";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { estadoPedido, formatoFecha, pagina } from "@/lib/dolibarr-model";
import { EnviarPedido } from "@/components/EnviarPedido";
import { CancelarPedido } from "@/components/CancelarPedido";
export const Route = createFileRoute("/admin/pedido")({
  validateSearch: (search: Record<string, unknown>): { pedido?: number | undefined } => ({
    pedido: documentoNotificado(search["pedido"]),
  }),
  head: () => ({ meta: [{ title: "Pedidos — Bimbo Dolibarr" }] }),
  component: Pedidos,
});
function Pedidos() {
  const { pedido: documentoId } = Route.useSearch();
  const { datos } = useDolibarr();
  const [detalle, setDetalle] = useState<number | null>(null);
  const [recojo, setRecojo] = useState<{
    id: number;
    ref: string;
    accion: "listo" | "retiro";
  } | null>(null);
  const [modalidad, setModalidad] = useState("todos");
  const { lineas, fijar, quitar, vaciar, totalImporte, bloqueado } = usePedido();
  const [revisando, setRevisando] = useState(false);
  const [programar, setProgramar] = useState<{
    id: number;
    ref: string;
    entrega: string | null;
    fecha: string | null;
  } | null>(null);
  const [entregar, setEntregar] = useState<{ id: number; ref: string } | null>(null);
  const [entregaFiltro, setEntregaFiltro] = useState("todos");
  const [canal, setCanal] = useState<FiltroCanal>("todos");
  const [consulta, setConsulta] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [numero, setNumero] = useState(1);
  const [cancelar, setCancelar] = useState<{ id: number; ref: string } | null>(null);
  useEffect(() => {
    setModalidad("todos");
    setConsulta("");
    setEstado("Todos");
    setCanal("todos");
    setNumero(1);
    setEntregaFiltro("todos");
  }, [documentoId]);
  const filtered = datos.pedidos.filter(
    (p) =>
      (!documentoId || p.id === documentoId) &&
      (modalidad === "todos" || p.modalidad === modalidad) &&
      `${p.ref} ${p.cliente}`.toLowerCase().includes(consulta.toLowerCase().trim()) &&
      (estado === "Todos" || estadoPedido(p.estado) === estado) &&
      coincideCanal(p.canal, canal) &&
      (entregaFiltro === "todos" ||
        (entregaFiltro === "entregados"
          ? !!p.fechaEntregaReal
          : !p.fechaEntregaReal && [1, 2, 3].includes(p.estado))),
  );
  const page = pagina(filtered, numero);
  return (
    <Pagina
      titulo="Pedidos"
      descripcion={`${datos.pedidos.length.toLocaleString("es-PE")} pedidos registrados en Dolibarr.`}
    >
      {documentoId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-blue-50 p-3 text-sm">
          <span>Pedido abierto desde una notificación</span>
          <Link to="/admin/pedido" search={{}} className="font-medium underline">
            Ver todos los pedidos
          </Link>
        </div>
      )}
      <DetallePedido id={detalle} cerrar={() => setDetalle(null)} admin />
      <GestionarRecojo seleccion={recojo} cerrar={() => setRecojo(null)} />
      <label className="space-y-1 text-sm">
        Modalidad
        <select
          aria-label="Filtrar modalidad"
          className="ml-3 rounded border p-2"
          value={modalidad}
          onChange={(e) => {
            setModalidad(e.target.value);
            setNumero(1);
          }}
        >
          <option value="todos">Todas</option>
          <option value="delivery">Delivery</option>
          <option value="recojo">Recojo en tienda</option>
        </select>
      </label>
      <ProgramarEntrega seleccion={programar} cerrar={() => setProgramar(null)} />
      <ConfirmarEntrega seleccion={entregar} cerrar={() => setEntregar(null)} />
      <CancelarPedido seleccion={cancelar} cerrar={() => setCancelar(null)} />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Nuevo pedido · {lineas.length} referencias</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/pedido-rapido">Pedido rápido</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Añade productos, selecciona el cliente y confirma para guardar el pedido y generar su
          factura y completar la salida de almacén con descuento de stock en Dolibarr.
        </p>
        <p className="text-xs text-muted-foreground">
          Los importes de esta lista son la referencia normal B2C. Al seleccionar un cliente, la
          revisión aplica su tarifa de Dolibarr.
        </p>
        {lineas.length ? (
          <fieldset
            disabled={bloqueado || revisando}
            className="min-w-0 space-y-4 disabled:opacity-60"
          >
            <div className="space-y-3">
              {lineas.map((l) => {
                const p = datos.productos.find((p) => p.sku === l.sku);
                return (
                  <div key={l.sku} className="flex flex-wrap items-center gap-3 border-b pb-3">
                    <ProductoImagen
                      src={p?.enVenta && p.tipo === 0 ? `/api/producto-foto?id=${p.id}` : null}
                      alt={p?.nombre ?? l.sku}
                      compact
                      className="size-16 shrink-0 border border-slate-100"
                    />
                    <div className="min-w-0 flex-1 basis-40 break-words">
                      <p className="text-sm font-medium">
                        {p?.nombre ?? `${l.sku} (no disponible)`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.sku} · {p?.unidad || "Unidad no definida"}
                      </p>
                      {(!p || l.planchas > p.stock || !p.enVenta) && (
                        <p className="text-xs text-destructive">
                          Revisar disponibilidad o cantidad.
                        </p>
                      )}
                    </div>
                    <Input
                      className="w-28"
                      aria-label={`Cantidad ${l.sku}`}
                      type="number"
                      min="0"
                      step="any"
                      value={l.planchas}
                      onChange={(e) => fijar(l.sku, Number(e.target.value))}
                    />
                    <span className="w-28 text-right text-sm">
                      <Dinero valor={p?.precio == null ? null : p.precio * l.planchas} />
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        quitar(l.sku);
                        toast.success("Producto quitado de la selección");
                      }}
                    >
                      Quitar
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-sm">
              <span>
                Referencia B2C sin impuestos:{" "}
                <strong>
                  <Dinero valor={totalImporte} />
                </strong>
              </span>
              <ConfirmarAccion
                variant="outline"
                size="sm"
                titulo="¿Vaciar la selección?"
                descripcion="Se quitarán los productos del pedido que estás preparando. Los pedidos ya registrados se conservarán."
                confirmar="Vaciar selección"
                onConfirm={() => {
                  vaciar();
                  toast.success("Selección vaciada");
                }}
              >
                Vaciar selección
              </ConfirmarAccion>
            </div>
          </fieldset>
        ) : (
          <Link to="/admin/inventario" className="text-sm text-primary">
            Seleccionar productos del inventario →
          </Link>
        )}
        <EnviarPedido onRevisando={setRevisando} />
        <EnDolibarr ruta="commande/list.php">Gestionar pedidos en Dolibarr</EnDolibarr>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-md"
          aria-label="Buscar pedidos"
          placeholder="Referencia o cliente"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setNumero(1);
          }}
        />
        <select
          aria-label="Estado de pedido"
          className="rounded-md border bg-background px-3 text-sm"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setNumero(1);
          }}
        >
          {["Todos", "Borrador", "Validado", "En proceso", "Cerrado", "Cancelado"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <label className="max-w-sm space-y-1 text-xs">
        Confirmación de entrega
        <select
          aria-label="Confirmación de entrega"
          value={entregaFiltro}
          onChange={(e) => {
            setEntregaFiltro(e.target.value);
            setNumero(1);
          }}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="todos">Todos los pedidos</option>
          <option value="entregados">Entregados</option>
          <option value="sin_confirmar">Sin confirmación</option>
        </select>
      </label>
      <FiltroCanalVenta
        value={canal}
        onChange={(v) => {
          setCanal(v);
          setNumero(1);
        }}
      />
      <p className="text-xs text-muted-foreground">
        “Según cliente actual” clasifica pedidos sin canal guardado; no modifica el pedido original.
      </p>
      {!filtered.length ? (
        <Vacio>No hay pedidos que coincidan con estos filtros.</Vacio>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <TablaAdaptable className="w-full text-left text-sm">
              <thead className="bg-navy-soft text-xs">
                <tr>
                  {[
                    "Pedido",
                    "Cliente",
                    "Canal",
                    "Fecha",
                    "Entrega prevista",
                    "Recepción del cliente",
                    "Total con impuestos",
                    "Estado",
                    "Acciones",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <EnDolibarr ruta={`commande/card.php?id=${p.id}`}>{p.ref}</EnDolibarr>
                    </td>
                    <td className="px-4 py-3">
                      {p.cliente}
                      <p className="mt-1 text-xs font-semibold">
                        {p.modalidad === "recojo" ? "Recojo en tienda" : "Delivery"}
                      </p>
                      {p.modalidad === "recojo" && (
                        <p className="text-xs text-muted-foreground">{p.puntoRecojo}</p>
                      )}
                      {p.modalidad !== "recojo" && p.direccionTienda && (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                          {p.direccionTienda}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CanalVenta canal={p.canal} fuenteCanal={p.fuenteCanal} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatoFecha(p.fecha)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p>
                        {p.modalidad === "recojo" ? "Recojo en tienda" : formatoFecha(p.entrega)}
                      </p>
                      {p.puedeProgramarEntrega && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            setProgramar({
                              id: p.id,
                              ref: p.ref,
                              entrega: p.entrega,
                              fecha: p.fecha,
                            })
                          }
                        >
                          {p.entrega ? "Cambiar fecha" : "Programar entrega"}
                        </Button>
                      )}
                    </td>
                    <td className="min-w-40 px-4 py-3">
                      {p.fechaEntregaReal ? (
                        <>
                          <span className="font-medium text-emerald-700">
                            {p.modalidad === "recojo" ? "Retirado" : "Entregado"}
                          </span>
                          <p className="text-xs">{formatoFecha(p.fechaEntregaReal)}</p>
                          <p className="text-xs text-muted-foreground">
                            Recibió: {p.recibidoPor || "No registrado"}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {p.estado === -1
                            ? "Cancelado"
                            : p.modalidad === "recojo"
                              ? p.listoRecojo
                                ? "Listo para recoger"
                                : "En preparación"
                              : "Sin confirmación"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Dinero valor={p.total} />
                    </td>
                    <td className="px-4 py-3">
                      <Estado>{estadoPedido(p.estado)}</Estado>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        className="mb-2 mr-2"
                        variant="outline"
                        size="sm"
                        onClick={() => setDetalle(p.id)}
                      >
                        Ver detalle
                      </Button>
                      {p.puedeGestionarRecojo && (
                        <Button
                          disabled={!!p.listoRecojo && !!p.bloqueoPago}
                          size="sm"
                          className="mb-2 whitespace-nowrap"
                          onClick={() =>
                            setRecojo({
                              id: p.id,
                              ref: p.ref,
                              accion: p.listoRecojo ? "retiro" : "listo",
                            })
                          }
                        >
                          {p.listoRecojo ? "Confirmar retiro" : "Marcar listo para recoger"}
                        </Button>
                      )}
                      {p.puedeConfirmarEntrega && (
                        <Button
                          disabled={!!p.bloqueoPago}
                          className="mb-2 whitespace-nowrap"
                          size="sm"
                          onClick={() => setEntregar({ id: p.id, ref: p.ref })}
                        >
                          Marcar como entregado
                        </Button>
                      )}
                      {p.bloqueoPago &&
                        (p.puedeConfirmarEntrega || (p.puedeGestionarRecojo && p.listoRecojo)) && (
                          <p className="mb-2 max-w-xs text-xs text-amber-800" role="status">
                            {p.bloqueoPago}
                          </p>
                        )}
                      {p.cancelablePortal ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelar({ id: p.id, ref: p.ref })}
                        >
                          Cancelar pedido
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {p.estado === -1 ? "Cancelado" : "Gestionar en Dolibarr"}
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
