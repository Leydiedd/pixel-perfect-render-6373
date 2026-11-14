import { ProductoImagen } from "@/components/ProductoImagen";
import { VisorFacturaPdf } from "@/components/VisorFacturaPdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TablaAdaptable } from "@/components/TablaAdaptable";
import { actualizarConAviso } from "@/lib/ux-feedback";
import { DetallePedido } from "@/components/DetallePedido";
import { AccionesPedidoCliente } from "@/components/AccionesPedidoCliente";
import { SeguimientoEntrega } from "@/components/SeguimientoEntrega";
import { hoyLima } from "@/lib/delivery-model";
import { nombrePago } from "@/lib/payment-presentation";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PasarelaDemo } from "@/components/PasarelaDemo";
import { useQuery } from "@tanstack/react-query";
import { FileText, RefreshCw } from "lucide-react";
import { useSesion, jsonApi } from "@/context/tienda";
import type { Cuenta } from "@/lib/store-model";
import { formatoMoneda, formatoFecha, estadoPedido, estadoFactura } from "@/lib/dolibarr-model";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/mi-cuenta")({ component: MiCuenta });
function MiCuenta() {
  const s = useSesion();
  const [historial, setHistorial] = useState<number | null>(null);
  const [pdf, setPdf] = useState<{ id: number; ref: string } | null>(null);
  const [pagar, setPagar] = useState<number | null>(null);
  const user = s.data?.sesion;
  const q = useQuery<Cuenta>({
    queryKey: ["cuenta", user?.id],
    queryFn: () => jsonApi("/api/cuenta"),
    enabled: user?.rol === "cliente",
    refetchInterval: 30000,
    retry: false,
  });
  if (s.isPending) return <p className="p-12 text-center">Consultando tu cuenta…</p>;
  if (!user || user.rol !== "cliente")
    return (
      <div className="space-y-5 p-12 text-center">
        <h1 className="text-2xl font-bold">Tu espacio de compras</h1>
        <p>Inicia sesión con una cuenta de cliente para ver sus pedidos.</p>
        <Button asChild>
          <Link to="/acceso" search={{ destino: "cuenta" }}>
            Iniciar sesión
          </Link>
        </Button>
      </div>
    );
  if (q.isPending) return <p className="p-12 text-center">Consultando tus documentos…</p>;
  if (q.isError || !q.data)
    return (
      <div className="space-y-4 p-12 text-center">
        <p role="alert">{q.error?.message || "No se pudo cargar tu cuenta."}</p>
        <Button onClick={() => void actualizarConAviso(() => q.refetch())}>Reintentar</Button>
      </div>
    );
  const d = q.data;
  const hoy = hoyLima();
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Dialog
        open={pdf !== null}
        onOpenChange={(open) => {
          if (!open) setPdf(null);
        }}
      >
        <DialogContent className="max-w-4xl min-w-0">
          <DialogHeader>
            <DialogTitle className="pr-6">Factura {pdf?.ref}</DialogTitle>
            <DialogDescription>
              Consulta tu factura o descarga el PDF en tu dispositivo.
            </DialogDescription>
          </DialogHeader>
          {pdf && (
            <VisorFacturaPdf
              key={pdf.id}
              url={"/api/cuenta?documento=" + pdf.id}
              referencia={pdf.ref}
            />
          )}
        </DialogContent>
      </Dialog>
      <DetallePedido id={historial} cerrar={() => setHistorial(null)} />
      <PasarelaDemo
        key={user.id}
        userId={user.id}
        facturaId={pagar}
        cuenta={d}
        cerrar={() => setPagar(null)}
        actualizar={() => void q.refetch()}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {user.canal === "b2b" ? "Cuenta de negocio" : "Cuenta personal"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Hola, {user.nombre}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {d.perfil.nombre} · {d.perfil.correo}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void actualizarConAviso(() => q.refetch())}
        >
          <RefreshCw className="size-4" />
          Actualizar
        </Button>
      </div>
      <div className="my-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Pedidos", d.pedidos.length],
          ["Facturas", d.facturas.length],
          [
            "Saldo pendiente",
            formatoMoneda(
              d.facturas.reduce((a, f) => a + f.saldo, 0),
              d.moneda,
            ),
          ],
        ].map(([name, value]) => (
          <div key={name} className="rounded-2xl border bg-white p-6">
            <p className="text-xs text-slate-500">{name}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-4 text-xl font-semibold">Mis pedidos</h2>
      <div className="mb-10 space-y-3">
        {!d.pedidos.length ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <p>Todavía no has realizado pedidos.</p>
            <Link to="/" className="mt-3 block text-primary underline">
              Explorar el catálogo
            </Link>
          </div>
        ) : (
          d.pedidos.map((p) => (
            <div
              key={p.id}
              id={`pedido-${p.id}`}
              className="scroll-mt-44 rounded-2xl border bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>{p.ref}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatoFecha(p.fecha)} · {p.canal?.toUpperCase() || "Pedido registrado"}
                  </p>
                </div>
                <div className="text-right">
                  <strong>{formatoMoneda(p.total, d.moneda)}</strong>
                  <p className="text-xs text-slate-500">
                    {p.estado === 3 ? "Pedido procesado" : estadoPedido(p.estado)}
                  </p>
                </div>
              </div>
              <AccionesPedidoCliente
                pedido={p}
                cuenta={d}
                pagar={setPagar}
                historial={() => setHistorial(p.id)}
              />
              <SeguimientoEntrega pedido={p} hoy={hoy} />
              <details className="mt-3 border-t pt-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Ver productos ({p.lineas.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {p.lineas.map((l, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3"
                    >
                      <ProductoImagen
                        src={
                          l.productoId && l.productoId > 0
                            ? `/api/producto-foto?id=${l.productoId}`
                            : null
                        }
                        alt={l.nombre}
                        compact
                        className="size-16 shrink-0"
                      />
                      <div className="min-w-0 flex-1 basis-32 break-words">
                        <span>
                          {l.cantidad} × {l.nombre}
                        </span>
                        <small className="block text-slate-500">{l.sku}</small>
                      </div>
                      <strong className="whitespace-nowrap">
                        {formatoMoneda(l.total, d.moneda)}
                      </strong>
                    </li>
                  ))}
                </ul>
              </details>
              {p.entrega && (
                <p className="mt-3 border-t pt-3 text-xs text-slate-500">
                  {p.modalidad === "recojo"
                    ? "Persona de contacto para el recojo: "
                    : `Delivery: ${p.entrega.direccion}, ${p.entrega.ciudad} · `}
                  {p.entrega.contacto}
                </p>
              )}
            </div>
          ))
        )}
      </div>
      <h2 id="mis-facturas" className="mb-4 scroll-mt-44 text-xl font-semibold">
        Mis facturas
      </h2>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <TablaAdaptable className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-[#eee9df] text-xs">
            <tr>
              {["Factura", "Fecha", "Total", "Saldo", "Estado", "Documento", "Pago"].map((v) => (
                <th key={v} className="p-4">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {d.facturas.map((f) => (
              <tr key={f.id}>
                <td className="p-4 font-semibold">{f.ref}</td>
                <td className="p-4">{formatoFecha(f.fecha)}</td>
                <td className="p-4">{formatoMoneda(f.total, d.moneda)}</td>
                <td className="p-4">{formatoMoneda(f.saldo, d.moneda)}</td>
                <td className="p-4">{estadoFactura(f)}</td>
                <td className="p-4">
                  {f.pdf ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPdf({ id: f.id, ref: f.ref })}
                      aria-label={"Ver PDF de " + f.ref}
                    >
                      <FileText className="size-4" />
                      Ver PDF
                    </Button>
                  ) : f.estado === 3 ? (
                    "Anulada"
                  ) : (
                    "PDF pendiente"
                  )}
                </td>
                <td className="p-4">
                  {f.pagoDemoPermitido ? (
                    <Button
                      size="sm"
                      className="whitespace-nowrap rounded-full"
                      onClick={() => setPagar(f.id)}
                    >
                      Pagar factura
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {f.pagada ? "Pagada" : f.estado === 3 ? "Anulada" : "No disponible"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TablaAdaptable>
        {!d.facturas.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            Tus facturas aparecerán aquí al confirmar un pedido.
          </p>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        {d.pasarelaDemo
          ? "Paga con tarjeta, Yape o Plin. Consulta el comprobante y el saldo actualizado en esta sección."
          : "Los cobros recibidos son confirmados por administración. Su registro actualiza el saldo de tu factura."}
      </p>
      {d.facturas.some((f) => f.pagos?.length) && (
        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Mis pagos</h2>
          {d.facturas.flatMap((f) =>
            (f.pagos || []).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"
              >
                <div>
                  <p className="font-semibold">{p.ref}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {f.ref} · {formatoFecha(p.fecha)} · {nombrePago(p.metodo)}
                  </p>
                </div>
                <strong>{formatoMoneda(p.importe, d.moneda)}</strong>
              </div>
            )),
          )}
        </section>
      )}
    </div>
  );
}
