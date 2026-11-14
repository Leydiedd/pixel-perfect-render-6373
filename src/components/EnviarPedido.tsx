import { BotonFacturaPdf } from "./BotonFacturaPdf";
import { crearSolicitudId } from "@/lib/solicitud-id";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsonApi } from "@/context/tienda";
import { condicionMayorista, precioParaCompra, type Catalogo } from "@/lib/store-model";
import { CondicionMayorista } from "./CondicionMayorista";
import { useDolibarr } from "@/context/dolibarr";
import { usePedido } from "@/context/pedido";
import {
  nuevoPedidoSchema,
  pedidoCreadoSchema,
  type NuevoPedido,
  type ResultadoPedido,
} from "@/lib/order-model";
import { estadoFactura, formatoCantidad } from "@/lib/dolibarr-model";
import { Button } from "@/components/ui/button";
import { Dinero, EnDolibarr } from "@/components/DatosReales";

export function EnviarPedido({ onRevisando }: { onRevisando: (valor: boolean) => void }) {
  const { datos, actualizar } = useDolibarr();
  const { lineas, pendiente, guardarPendiente, resolverPendiente, bloqueado } = usePedido();
  const [clienteId, setClienteId] = useState("");
  const tarifa = useQuery<Catalogo>({
    queryKey: ["admin", "tarifa-cliente", clienteId],
    queryFn: () => jsonApi(`/api/tienda?clienteId=${clienteId}`),
    enabled: !!clienteId,
    staleTime: 0,
    refetchInterval: 30000,
    retry: false,
  });
  const [revision, setRevision] = useState<NuevoPedido | null>(null);
  const [creado, setCreado] = useState<ResultadoPedido | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const resumen = pendiente ?? revision;
  const condicion = condicionMayorista(
    lineas.map((l) => ({
      id: datos.productos.find((p) => p.sku === l.sku)?.id ?? 0,
      cantidad: l.planchas,
    })),
    tarifa.data,
  );
  const [revisionTarifa, setRevisionTarifa] = useState("");
  useEffect(() => {
    onRevisando(!!resumen);
  }, [resumen, onRevisando]);
  const subtotal =
    resumen?.lineas.reduce(
      (sum, l) => sum + Math.round(l.cantidad * l.precioEsperado * 100) / 100,
      0,
    ) ?? 0;
  const impuesto =
    resumen?.lineas.reduce(
      (sum, l) => sum + Math.round(l.cantidad * l.precioEsperado * l.impuestoEsperado) / 100,
      0,
    ) ?? 0;

  function revisar() {
    setError("");
    setCreado(null);
    if (!tarifa.data || tarifa.isError || tarifa.isFetching) {
      setError("Espera a que se consulte la tarifa del cliente en Dolibarr.");
      return;
    }
    if (!datos.fuente.almacenVenta) {
      setError("El almacén de venta no está activo en Dolibarr.");
      return;
    }
    const productos = lineas.map((l) => ({
      l,
      p: datos.productos.find((p) => p.sku === l.sku),
      precio: tarifa.data.productos.find((p) => p.sku === l.sku),
    }));
    if (
      productos.some(
        ({ l, p, precio }) =>
          !p ||
          !precio ||
          !p.enVenta ||
          p.precio === null ||
          p.impuesto === null ||
          (p.gestionaStock &&
            l.planchas >
              (p.almacenes.find((a) => a.id === datos.fuente.almacenVenta?.id)?.cantidad ?? 0)),
      )
    ) {
      setError(`Revisa las cantidades disponibles en ${datos.fuente.almacenVenta.nombre}.`);
      return;
    }
    const parsed = nuevoPedidoSchema.safeParse({
      solicitudId: crearSolicitudId(),
      clienteId: Number(clienteId),
      lineas: productos.map(({ l, p, precio }) => ({
        productoId: p!.id,
        cantidad: l.planchas,
        precioEsperado: precioParaCompra(precio!, condicion).precio,
        impuestoEsperado: precioParaCompra(precio!, condicion).impuesto,
      })),
    });
    if (!parsed.success) {
      setError(
        "Selecciona un cliente y cantidades positivas con un máximo de cuatro decimales (hasta 100 productos).",
      );
      return;
    }
    setRevision(parsed.data);
    setRevisionTarifa(condicion.tarifa || "");
  }

  async function enviar() {
    if (!resumen || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError("");
    try {
      if (!pendiente) guardarPendiente(resumen);
      const response = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bimbo-Request": "order" },
        body: JSON.stringify(resumen),
        signal: AbortSignal.timeout(50_000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.revisable === true) {
          resolverPendiente(false);
          setRevision(null);
          actualizar();
          void tarifa.refetch();
        }
        setError(
          typeof result.error === "string"
            ? result.error
            : "No se pudo guardar. Reintenta el mismo envío.",
        );
        return;
      }
      const success = pedidoCreadoSchema.parse(result);
      toast.success("Pedido confirmado", {
        description: `Pedido ${success.pedido.ref} y factura ${success.factura.ref} registrados.`,
      });
      resolverPendiente(true);
      setRevision(null);
      setCreado(success);
      actualizar();
    } catch {
      setError(
        "No se pudo confirmar el envío. Reintenta para recuperar el pedido y la factura sin duplicarlos. Si el navegador bloquea el almacenamiento, habilítalo antes de continuar.",
      );
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <section className="space-y-4 border-t pt-5" aria-label="Enviar pedido a Dolibarr">
      {creado && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-950"
        >
          <p className="font-semibold">
            Pedido {creado.pedido.ref} y factura {creado.factura.ref} registrados en Dolibarr
          </p>
          <p className="mt-1 text-sm">
            Total de la factura: <Dinero valor={creado.factura.total} /> ·{" "}
            {estadoFactura(creado.factura)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <EnDolibarr ruta={`commande/card.php?id=${creado.pedido.id}`}>
              Ver detalle del pedido
            </EnDolibarr>
            {creado.stock.expedicion && (
              <EnDolibarr ruta={`expedition/card.php?id=${creado.stock.expedicion.id}`}>
                Ver salida {creado.stock.expedicion.ref}
              </EnDolibarr>
            )}
            <EnDolibarr ruta={`compta/facture/card.php?facid=${creado.factura.id}`}>
              Ver factura y pagos
            </EnDolibarr>
            {creado.factura.pdf && (
              <BotonFacturaPdf
                url={"/api/dolibarr?documento=" + creado.factura.id}
                referencia={creado.factura.ref}
              >
                Ver PDF de la factura
              </BotonFacturaPdf>
            )}
          </div>
          {creado.stock.estado === "descontado" && (
            <div className="mt-3 text-sm">
              <p className="font-semibold">Stock descontado · {creado.stock.almacen?.nombre}</p>
              <p>Salida {creado.stock.expedicion?.ref} completada. Pedido cerrado.</p>
              <ul>
                {creado.stock.lineas.map((l) => (
                  <li key={l.movimientoId}>
                    {l.sku}: −{formatoCantidad(l.cantidad)} unidades
                  </li>
                ))}
              </ul>
            </div>
          )}
          {creado.stock.estado === "sin_productos" && (
            <p className="mt-3 text-sm">El pedido no contiene productos con control de stock.</p>
          )}
          {creado.aviso && <p className="mt-3 text-sm">{creado.aviso}</p>}
        </div>
      )}
      {(lineas.length > 0 || pendiente) && (
        <>
          <label className="block space-y-2 text-sm font-medium">
            <span>Cliente del pedido</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 font-normal"
              aria-label="Cliente del pedido"
              disabled={bloqueado || !!revision}
              value={resumen ? String(resumen.clienteId) : clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Seleccionar cliente de Dolibarr</option>
              {datos.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.codigo ? ` · ${c.codigo}` : ""}
                </option>
              ))}
            </select>
          </label>
          <EnDolibarr ruta="admin/const.php">Configurar mínimo mayorista en Dolibarr →</EnDolibarr>
          {clienteId && !resumen && (
            <p className="text-sm text-muted-foreground">
              {tarifa.isFetching
                ? "Consultando tarifa del cliente…"
                : tarifa.isError
                  ? "No se pudo consultar la tarifa."
                  : `Tarifa aplicable: ${condicion.tarifa}. Los importes de la revisión usan los precios de este cliente.`}
            </p>
          )}
          {tarifa.isError && !resumen && (
            <Button variant="outline" onClick={() => void tarifa.refetch()}>
              Reintentar tarifa
            </Button>
          )}
          {!resumen ? (
            <>
              {tarifa.data && !tarifa.isError && (
                <CondicionMayorista condicion={condicion} moneda={tarifa.data.moneda} />
              )}
              <Button
                disabled={
                  bloqueado || !clienteId || !tarifa.data || tarifa.isFetching || tarifa.isError
                }
                onClick={revisar}
              >
                Revisar y enviar pedido
              </Button>
            </>
          ) : (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold">
                {pendiente ? "Confirmar resultado del envío" : "Confirma tu pedido"}
              </h3>
              {!pendiente && <p className="text-sm">Tarifa aplicada: {revisionTarifa}</p>}
              <p className="text-sm">
                Cliente:{" "}
                {datos.clientes.find((c) => c.id === resumen.clienteId)?.nombre ??
                  `Cliente ${resumen.clienteId}`}
              </p>
              <ul className="space-y-1 text-sm">
                {resumen.lineas.map((l) => (
                  <li key={l.productoId}>
                    {formatoCantidad(l.cantidad)} ×{" "}
                    {datos.productos.find((p) => p.id === l.productoId)?.nombre ??
                      `Producto ${l.productoId}`}{" "}
                    — <Dinero valor={l.cantidad * l.precioEsperado} />
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t pt-3 text-sm">
                <p>
                  Subtotal: <Dinero valor={subtotal} />
                </p>
                <p>
                  Impuestos estimados: <Dinero valor={impuesto} />
                </p>
                <p className="font-semibold">
                  Total estimado: <Dinero valor={subtotal + impuesto} />
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Se crearán el pedido, su factura pendiente de pago y una salida de almacén
                completada. El stock se descontará de{" "}
                {datos.fuente.almacenVenta?.nombre ?? "el almacén configurado"} y el pedido quedará
                cerrado.
              </p>
              {pendiente && (
                <p className="text-sm">
                  Hay un envío pendiente de confirmar. El reintento recupera el mismo pedido y su
                  factura.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button disabled={enviando} onClick={() => void enviar()}>
                  {enviando
                    ? "Guardando en Dolibarr…"
                    : pendiente
                      ? "Reintentar el mismo envío"
                      : "Confirmar pedido, factura y salida"}
                </Button>
                {!pendiente && (
                  <Button variant="outline" disabled={enviando} onClick={() => setRevision(null)}>
                    Volver a editar
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
