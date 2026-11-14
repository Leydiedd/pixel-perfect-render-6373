import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import {
  cancelarPedidoSchema,
  pedidoCanceladoSchema,
  type CancelacionPedido,
  type ResultadoCancelacion,
} from "@/lib/order-model";
import { formatoCantidad } from "@/lib/dolibarr-model";
import { EnDolibarr } from "@/components/DatosReales";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const storageKey = "bimbo-dolibarr-cancelacion-v1";
export function CancelarPedido({
  seleccion,
  cerrar,
}: {
  seleccion: { id: number; ref: string } | null;
  cerrar: () => void;
}) {
  const { datos, actualizar } = useDolibarr();
  const [motivo, setMotivo] = useState("");
  const [pendiente, setPendiente] = useState<CancelacionPedido | null>(null);
  const [resultado, setResultado] = useState<ResultadoCancelacion | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [enviando, setEnviando] = useState(false);
  const [recuperado, setRecuperado] = useState<number | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = cancelarPedidoSchema.safeParse(JSON.parse(saved));
        if (parsed.success) {
          setPendiente(parsed.data);
          setRecuperado(parsed.data.pedidoId);
        }
      }
    } catch {
      /* Submission reports unavailable storage before making any request. */
    }
  }, []);
  useEffect(() => {
    if (!pendiente) {
      setMotivo("");
      setError("");
    }
  }, [seleccion?.id]);
  const pedidoId = pendiente?.pedidoId ?? seleccion?.id ?? recuperado;
  const referencia =
    datos.pedidos.find((p) => p.id === pedidoId)?.ref ?? seleccion?.ref ?? `#${pedidoId}`;
  function close() {
    if (enviando || pendiente) return;
    setResultado(null);
    setError("");
    setMotivo("");
    setRecuperado(null);
    cerrar();
  }
  async function confirmar() {
    if (busy.current) return;
    const parsed = cancelarPedidoSchema.safeParse(pendiente ?? { pedidoId, motivo });
    if (!parsed.success) {
      setError("Escribe un motivo de 3 a 500 caracteres.");
      return;
    }
    busy.current = true;
    setEnviando(true);
    setError("");
    try {
      localStorage.setItem(storageKey, JSON.stringify(parsed.data));
      setPendiente(parsed.data);
      const response = await fetch("/api/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Bimbo-Request": "order" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(50_000),
      });
      const body = await response.json();
      if (!response.ok) {
        if ([400, 403, 409].includes(response.status)) {
          localStorage.removeItem(storageKey);
          setPendiente(null);
          actualizar();
        }
        setError(body.error ?? "No se pudo cancelar el pedido.");
        return;
      }
      const success = pedidoCanceladoSchema.parse(body);
      toast.success("Pedido cancelado", {
        description: "Consulta el resultado de la anulación y la devolución de stock.",
      });
      localStorage.removeItem(storageKey);
      setPendiente(null);
      setResultado(success);
      actualizar();
    } catch {
      setError(
        "No se pudo confirmar el resultado. Reintenta la cancelación del mismo pedido; no se duplicará la devolución. Si el navegador bloquea el almacenamiento, habilítalo.",
      );
    } finally {
      busy.current = false;
      setEnviando(false);
    }
  }
  return (
    <Dialog
      open={!!seleccion || !!pendiente || !!resultado || !!recuperado}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resultado ? "Pedido cancelado" : `Cancelar pedido ${referencia}`}
          </DialogTitle>
          <DialogDescription>
            {resultado
              ? "La devolución y la anulación quedaron registradas en Dolibarr."
              : "Se devolverán las unidades descontadas al almacén original, se cancelará la salida y se anulará la factura vinculada. Los documentos permanecerán en el historial."}
          </DialogDescription>
        </DialogHeader>
        {resultado ? (
          <>
            <div
              role="status"
              className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"
            >
              <p>Pedido {resultado.pedido.ref}: cancelado.</p>
              <p>Factura {resultado.factura.ref}: anulada.</p>
              {resultado.expedicion && <p>Salida {resultado.expedicion.ref}: cancelada.</p>}
              <p className="font-semibold">Stock devuelto · {resultado.stock.almacen.nombre}</p>
              <ul>
                {resultado.stock.lineas.map((l) => (
                  <li key={l.movimientoId}>
                    {l.sku}: +{formatoCantidad(l.cantidad)} unidades
                  </li>
                ))}
              </ul>
              {!resultado.stock.lineas.length && <p>Sin productos con control de stock.</p>}
              <p>Motivo: {resultado.motivo}</p>
              {resultado.repetido && <p>Cancelación recuperada. No se volvió a devolver stock.</p>}
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <EnDolibarr ruta={`commande/card.php?id=${resultado.pedido.id}`}>
                Ver pedido
              </EnDolibarr>
              <EnDolibarr ruta={`compta/facture/card.php?facid=${resultado.factura.id}`}>
                Ver factura anulada
              </EnDolibarr>
            </div>
            <Button onClick={close}>Cerrar</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Si la factura tiene pagos, abonos o cambios posteriores, deberás gestionar la
              cancelación en Dolibarr.
            </p>
            <label className="space-y-2 text-sm font-medium">
              Motivo de cancelación
              <textarea
                aria-label="Motivo de cancelación"
                className="min-h-24 w-full rounded-md border bg-background p-3"
                maxLength={500}
                disabled={!!pendiente || enviando}
                value={pendiente?.motivo ?? motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            {pendiente && (
              <p className="text-sm">
                Hay una cancelación pendiente de confirmar para {referencia}. Reintenta para
                recuperar su resultado.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="destructive" disabled={enviando} onClick={() => void confirmar()}>
                {enviando
                  ? "Cancelando en Dolibarr…"
                  : pendiente
                    ? "Reintentar cancelación"
                    : "Cancelar pedido y devolver stock"}
              </Button>
              <Button variant="outline" disabled={enviando || !!pendiente} onClick={close}>
                Volver
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
