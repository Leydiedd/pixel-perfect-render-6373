import { crearSolicitudId } from "@/lib/solicitud-id";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { recojoSchema, type Recojo } from "@/lib/pickup-model";
import { useEffect, useRef, useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import { hoyLima } from "@/lib/delivery-model";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function GestionarRecojo({
  seleccion,
  cerrar,
}: {
  seleccion: { id: number; ref: string; accion: "listo" | "retiro" } | null;
  cerrar: () => void;
}) {
  const { actualizar } = useDolibarr();
  const [fecha, setFecha] = useState(hoyLima);
  const [receptor, setReceptor] = useState("");
  const [pending, setPending] = useState<Recojo | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const key = "bimbo-pickup-v1";
  useEffect(() => {
    try {
      const p = recojoSchema.safeParse(JSON.parse(localStorage.getItem(key) || "null"));
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
    const parsed = recojoSchema.safeParse(
      pending ?? {
        solicitudId: crearSolicitudId(),
        pedidoId: seleccion?.id,
        accion: seleccion?.accion,
        ...(seleccion?.accion === "retiro" ? { fecha, receptor } : {}),
      },
    );
    if (!parsed.success) {
      setError("Completa la fecha y el nombre de quien retiró el pedido.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify(parsed.data));
      setPending(parsed.data);
      const r = await fetch("/api/recojos", {
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
        setError(body.error || "No se pudo confirmar el recojo.");
        return;
      }
      if (!body.ok) throw new Error("Respuesta inválida");
      toast.success(
        parsed.data.accion === "listo" ? "Pedido listo para recoger" : "Retiro confirmado",
      );
      localStorage.removeItem(key);
      setPending(null);
      actualizar();
      cerrar();
    } catch {
      setError(
        "No se pudo confirmar el resultado. Reintenta el mismo envío; no se duplicará el registro.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const retirar = (pending?.accion ?? seleccion?.accion) === "retiro";
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
          <DialogTitle>
            {retirar ? "Confirmar retiro" : "Listo para recoger"}{" "}
            {seleccion?.ref ?? `#${pending?.pedidoId}`}
          </DialogTitle>
          <DialogDescription>
            {retirar
              ? "Confirma que el cliente retiró el pedido completo. La fecha y quien lo retiró quedarán guardados en Dolibarr."
              : "Confirma que todos los productos están preparados para retirar. El cliente recibirá una notificación."}
          </DialogDescription>
        </DialogHeader>
        {retirar && (
          <>
            <label className="space-y-1 text-sm">
              Fecha de retiro
              <Input
                aria-label="Fecha de retiro"
                type="date"
                max={hoyLima()}
                value={(pending?.accion === "retiro" ? pending.fecha : null) ?? fecha}
                disabled={!!pending || busy}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              Retirado por
              <Input
                aria-label="Retirado por"
                placeholder="Nombre de quien retiró el pedido"
                maxLength={128}
                value={(pending?.accion === "retiro" ? pending.receptor : null) ?? receptor}
                disabled={!!pending || busy}
                onChange={(e) => setReceptor(e.target.value)}
              />
            </label>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {retirar
            ? "Verifica el pedido y la persona que lo retira antes de confirmar."
            : "Marca listo únicamente cuando el pedido esté preparado."}
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
            ? "Guardando…"
            : pending
              ? "Reintentar confirmación"
              : retirar
                ? "Confirmar retiro"
                : "Marcar listo para recoger"}
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
