import { ProductoImagen } from "@/components/ProductoImagen";
import { TablaAdaptable } from "@/components/TablaAdaptable";
import { useQuery } from "@tanstack/react-query";
import { jsonApi, useSesion } from "@/context/tienda";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { formatoMoneda, formatoFecha } from "@/lib/dolibarr-model";
import { textoPago, type DetallePedido as Detalle } from "@/lib/order-experience";
export function DetallePedido({
  id,
  cerrar,
  admin = false,
  urlDolibarr,
}: {
  id: number | null;
  cerrar: () => void;
  admin?: boolean;
  urlDolibarr?: string;
}) {
  const s = useSesion();
  const q = useQuery<Detalle>({
    queryKey: ["detalle-pedido", s.data?.sesion?.id, id],
    queryFn: () => jsonApi(`/api/pedido-detalle?id=${id}`),
    enabled: !!id && !!s.data?.sesion,
    refetchInterval: id ? 15000 : false,
  });
  const d = q.data;
  return (
    <Dialog
      open={!!id}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d?.ref || "Detalle del pedido"}</DialogTitle>
          <DialogDescription>
            {admin ? "Productos, entrega y pagos del pedido" : "Historial de tu pedido"}
          </DialogDescription>
        </DialogHeader>
        {q.isPending ? (
          <p>Cargando el pedido…</p>
        ) : q.isError ? (
          <div role="alert">
            <p>{q.error.message}</p>
            <Button onClick={() => void q.refetch()}>Reintentar</Button>
          </div>
        ) : (
          d && (
            <div className="space-y-6">
              <section className="rounded-xl border bg-slate-50 p-4">
                <p className="font-semibold">{textoPago[d.pago.estado]}</p>
                <p className="mt-2 text-sm">
                  Cobrado: {formatoMoneda(d.pago.cobrado, d.moneda)} · Saldo:{" "}
                  {formatoMoneda(d.pago.saldo, d.moneda)}
                </p>
                {d.pago.creditos > 0 && (
                  <p className="text-sm">
                    Créditos aplicados: {formatoMoneda(d.pago.creditos, d.moneda)}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {d.pago.facturas.map((f) => f.ref).join(" · ") || "Sin factura vinculada"}
                </p>
              </section>
              {admin && (
                <>
                  <section className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <h3 className="font-semibold">Cliente y contacto</h3>
                      <p>{d.cliente}</p>
                      <p>{d.entrega?.contacto || "Contacto del pedido no registrado"}</p>
                      <p>
                        {d.entrega?.telefono ||
                          d.contactoActual.telefono ||
                          "Teléfono no registrado"}
                      </p>
                      <p>{d.contactoActual.correo}</p>
                      {!d.entrega && (
                        <p className="text-xs text-slate-500">
                          Datos actuales del cliente; no existe una dirección guardada con este
                          pedido.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {d.modalidad === "recojo" ? "Recojo en tienda" : "Delivery"}
                      </h3>
                      <p>
                        {d.modalidad === "recojo"
                          ? d.puntoRecojo || "Punto no registrado"
                          : [
                              d.entrega?.direccion ?? d.contactoActual.direccion,
                              d.entrega?.ciudad ?? d.contactoActual.ciudad,
                            ]
                              .filter(Boolean)
                              .join(", ") || "Dirección no registrada"}
                      </p>
                      {d.recibidoPor && <p>Recibió: {d.recibidoPor}</p>}
                    </div>
                  </section>
                </>
              )}
              <div className="overflow-x-auto">
                <h3 className="mb-3 font-semibold">Productos del pedido</h3>
                <TablaAdaptable className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {["Producto", "Cantidad", "Precio sin IGV", "Total"].map((t) => (
                        <th className="p-2" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.lineas.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">
                          <div className="flex items-center gap-3">
                            <ProductoImagen
                              src={
                                l.productoId > 0 ? `/api/producto-foto?id=${l.productoId}` : null
                              }
                              alt={l.nombre}
                              compact
                              className="size-16 shrink-0 border border-slate-100"
                            />
                            <div className="min-w-0 break-words">
                              {l.nombre}
                              <small className="block text-slate-500">{l.sku}</small>
                            </div>
                          </div>
                        </td>
                        <td className="p-2">{l.cantidad}</td>
                        <td className="p-2">{formatoMoneda(l.precio, d.moneda)}</td>
                        <td className="p-2">{formatoMoneda(l.total, d.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TablaAdaptable>
              </div>
              <section>
                <h3 className="mb-4 font-semibold">Historial del pedido</h3>
                <ol className="ml-2 space-y-5 border-l-2 border-slate-200 pl-5">
                  {d.historial.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-[#20344e]" />
                      <p className="text-xs text-slate-500">
                        {!e.fecha
                          ? "Sin fecha de registro"
                          : e.fecha.length === 10
                            ? formatoFecha(e.fecha)
                            : new Date(e.fecha).toLocaleString("es-PE", {
                                timeZone: "America/Lima",
                              })}
                      </p>
                      <p className="font-medium">{e.titulo}</p>
                      <p className="text-sm text-slate-600">{e.detalle}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-slate-500">
                  Se muestran los eventos registrados. Los pedidos antiguos pueden no conservar
                  todos los cambios.
                </p>
              </section>
            </div>
          )
        )}
        {admin && urlDolibarr && (
          <Button variant="outline" asChild>
            <a href={urlDolibarr} target="_blank" rel="noreferrer">
              Abrir pedido en Dolibarr ↗
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
