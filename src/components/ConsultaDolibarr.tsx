import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useDolibarr } from "@/context/dolibarr";
import { DetallePedido } from "./DetallePedido";
import { HistorialFactura } from "./HistorialFactura";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { formatoMoneda, formatoFecha, estadoExpedicion } from "@/lib/dolibarr-model";
import { destinoDolibarr } from "@/lib/mobile-links";

export function ConsultaDolibarr({
  ruta,
  cerrar,
  soloErp = false,
}: {
  ruta: string;
  cerrar: () => void;
  soloErp?: boolean;
}) {
  const { datos } = useDolibarr();
  const [vista, setVista] = useState<"pagos" | "pdf">("pagos");
  const destino = destinoDolibarr(ruta);
  const base = new URL(datos.fuente.url.replace(/\/?$/, "/"));
  const candidate = new URL(ruta, base);
  const url =
    candidate.origin === base.origin && candidate.pathname.startsWith(base.pathname)
      ? candidate.href
      : base.href;
  if (!soloErp && destino.tipo === "pedido")
    return <DetallePedido admin id={destino.id} cerrar={cerrar} urlDolibarr={url} />;
  if (!soloErp && destino.tipo === "factura")
    return (
      <HistorialFactura
        facturaId={destino.id}
        vista={vista}
        cambiarVista={setVista}
        cerrar={cerrar}
      />
    );
  const producto =
    !soloErp && destino.tipo === "producto"
      ? datos.productos.find((p) => p.id === destino.id)
      : undefined;
  const salida =
    !soloErp && destino.tipo === "expedicion"
      ? datos.expediciones.find((e) => e.id === destino.id)
      : undefined;
  const cliente =
    !soloErp && destino.tipo === "cliente"
      ? datos.clientes.find((c) => c.id === destino.id)
      : undefined;
  const titulo = producto?.nombre || salida?.ref || cliente?.nombre || "Abrir gestión en Dolibarr";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <DialogContent className="max-w-2xl min-w-0">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {producto || salida || cliente
              ? "Datos consultados en Dolibarr desde el panel."
              : "Esta función se gestiona directamente en Dolibarr."}
          </DialogDescription>
        </DialogHeader>
        {producto && (
          <div className="space-y-3 text-sm">
            <p>
              Referencia: <strong>{producto.sku}</strong>
            </p>
            <p>{producto.descripcion || "Sin descripción"}</p>
            <p>
              Precio sin impuestos:{" "}
              {producto.precio === null
                ? "Sin precio"
                : formatoMoneda(producto.precio, datos.empresa.moneda)}
            </p>
            <p>
              Stock: {producto.stock} · {producto.unidad || "Unidad no registrada"}
            </p>
            <Button asChild variant="outline">
              <Link to="/admin/producto/$sku" params={{ sku: producto.sku }} onClick={cerrar}>
                Ver ficha y existencias
              </Link>
            </Button>
          </div>
        )}
        {salida && (
          <dl className="grid gap-3 text-sm">
            {[
              ["Cliente", salida.cliente],
              ["Destino", salida.destino || "No registrado"],
              ["Fecha de salida", formatoFecha(salida.fecha)],
              ["Entrega prevista", formatoFecha(salida.entrega)],
              ["Estado", estadoExpedicion(salida.estado)],
              ["Seguimiento", salida.seguimiento || "Sin código"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {cliente && (
          <div className="space-y-3 text-sm">
            <p>Código: {cliente.codigo || "Sin código registrado"}</p>
            <h3 className="font-semibold">Facturas del cliente</h3>
            {datos.facturas
              .filter((f) => f.clienteId === cliente.id)
              .map((f) => (
                <Link
                  key={f.id}
                  className="block rounded border p-3 text-primary"
                  to="/admin/boletas"
                  search={{ factura: f.id }}
                  onClick={cerrar}
                >
                  {f.ref} · {formatoMoneda(f.total, datos.empresa.moneda)}
                </Link>
              ))}
            {!datos.facturas.some((f) => f.clienteId === cliente.id) && (
              <p>No hay facturas vinculadas en la consulta actual.</p>
            )}
          </div>
        )}
        <details className="rounded-lg border p-3 text-sm" open={!producto && !salida && !cliente}>
          <summary className="cursor-pointer py-2 font-medium">
            Gestión avanzada en Dolibarr
          </summary>
          <p className="my-3">
            Abre Dolibarr para editar este registro o usar las opciones del ERP. Inicia sesión con
            tu usuario de Dolibarr. Desde el celular, mantén la conexión al mismo Wi-Fi y la PC
            encendida con Apache y MySQL activos.
          </p>
          <label className="block text-xs text-muted-foreground">
            Dirección de Dolibarr
            <input
              aria-label="Dirección de Dolibarr"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 w-full min-w-0 rounded border p-2 text-xs"
            />
          </label>
          {
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 items-center text-primary underline"
            >
              Abrir Dolibarr ↗
            </a>
          }
        </details>
        <Button variant="outline" onClick={cerrar}>
          Volver
        </Button>
      </DialogContent>
    </Dialog>
  );
}
