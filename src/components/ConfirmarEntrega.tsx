import { crearSolicitudId } from "@/lib/solicitud-id";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import {
  entregaPedidoSchema,
  entregaConfirmadaSchema,
  hoyLima,
  type EntregaPedido,
} from "@/lib/delivery-model";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function ConfirmarEntrega({
  seleccion,
  cerrar,
}: {
  seleccion: { id: number; ref: string } | null;
  cerrar: () => void;
}) {
  const { actualizar } = useDolibarr();
  const [fecha, setFecha] = useState(hoyLima);
  const [receptor, setReceptor] = useState("");
  const [pending, setPending] = useState<EntregaPedido | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const key = "bimbo-delivery-v1";
  useEffect(() => {
    try {
      const p = entregaPedidoSchema.safeParse(JSON.parse(localStorage.getItem(key) || "null"));
      if (p.success) setPending(p.data);
    } catch {}
  }, []);
  useEffect(() => {
    if (seleccion) {
      setFecha(hoyLima());
      setReceptor("");
      setError("");
    }
  }, [seleccion?.id]);
  async function confirm() {
    if (sending.current) return;
    const parsed = entregaPedidoSchema.safeParse(
      pending ?? { solicitudId: crearSolicitudId(), pedidoId: seleccion?.id, fecha, receptor },
    );
    if (!parsed.success) {
      setError("Completa la fecha y el nombre de quien recibió el pedido.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify(parsed.data));
      setPending(parsed.data);
      const r = await fetch("/api/entregas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bimbo-Request": "order" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(50000),
      });
      const body = await r.json();
      if (!r.ok) {
        if (body.revisable) {
          localStorage.removeItem(key);
          setPending(null);
          actualizar();
        }
        setError(body.error || "No se pudo confirmar la entrega.");
        return;
      }
      entregaConfirmadaSchema.parse(body);
      toast.success("Entrega confirmada", {
        description: "La recepción del pedido quedó registrada.",
      });
      localStorage.removeItem(key);
      setPending(null);
      actualizar();
      cerrar();
    } catch {
      setError(
        "No se pudo confirmar el resultado. Reintenta el mismo envío; no se duplicará la entrega.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!seleccion || !!pending}
      onOpenChange={(v) => {
        if (!v && !pending && !busy) cerrar();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (pending || busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (pending || busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Confirmar entrega {seleccion?.ref ?? `#${pending?.pedidoId}`}</DialogTitle>
          <DialogDescription>
            Confirma que el cliente recibió el pedido completo. La fecha y el receptor quedarán
            registrados en Dolibarr.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">
          Fecha real de entrega
          <Input
            aria-label="Fecha real de entrega"
            type="date"
            max={hoyLima()}
            value={pending?.fecha ?? fecha}
            disabled={!!pending || busy}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Recibido por
          <Input
            aria-label="Recibido por"
            placeholder="Nombre de quien recibió el pedido"
            maxLength={128}
            value={pending?.receptor ?? receptor}
            disabled={!!pending || busy}
            onChange={(e) => setReceptor(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Las expediciones cubren las líneas del pedido. Esta confirmación registra la recepción del
          cliente.
        </p>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        )}
        {pending && !busy && (
          <p className="text-sm">
            Hay un envío pendiente de confirmar. Reintenta para recuperar el resultado.
          </p>
        )}
        <Button disabled={busy} onClick={() => void confirm()}>
          {busy
            ? "Guardando entrega…"
            : pending
              ? "Reintentar confirmación"
              : "Confirmar pedido entregado"}
        </Button>
        {!pending && (
          <Button variant="outline" disabled={busy} onClick={cerrar}>
            Volver
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
