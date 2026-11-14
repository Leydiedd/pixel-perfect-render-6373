import { crearSolicitudId } from "@/lib/solicitud-id";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import {
  fechaPrevistaSchema,
  fechaProgramadaSchema,
  hoyLima,
  type FechaPrevista,
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
export function ProgramarEntrega({
  seleccion,
  cerrar,
}: {
  seleccion: { id: number; ref: string; entrega: string | null; fecha: string | null } | null;
  cerrar: () => void;
}) {
  const { actualizar } = useDolibarr();
  const [fecha, setFecha] = useState(hoyLima);
  const [pending, setPending] = useState<FechaPrevista | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const key = "bimbo-delivery-plan-v1";
  useEffect(() => {
    try {
      const p = fechaPrevistaSchema.safeParse(JSON.parse(localStorage.getItem(key) || "null"));
      if (p.success) setPending(p.data);
    } catch {}
  }, []);
  useEffect(() => {
    if (seleccion) {
      setFecha(seleccion.entrega ?? hoyLima());
      setError("");
    }
  }, [seleccion?.id]);
  async function confirm() {
    if (sending.current) return;
    const parsed = fechaPrevistaSchema.safeParse(
      pending ?? {
        solicitudId: crearSolicitudId(),
        pedidoId: seleccion?.id,
        fecha,
        anterior: seleccion?.entrega ?? null,
      },
    );
    if (!parsed.success) {
      setError("Completa la fecha prevista de entrega.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify(parsed.data));
      setPending(parsed.data);
      const r = await fetch("/api/entregas-previstas", {
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
      fechaProgramadaSchema.parse(body);
      toast.success("Fecha de entrega guardada", {
        description: "El cliente puede consultar la programación en su cuenta.",
      });
      localStorage.removeItem(key);
      setPending(null);
      actualizar();
      cerrar();
    } catch {
      setError(
        "No se pudo confirmar el resultado. Reintenta el mismo envío; no se duplicará el cambio.",
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
          <DialogTitle>Fecha prevista {seleccion?.ref ?? `#${pending?.pedidoId}`}</DialogTitle>
          <DialogDescription>
            Programa cuándo debe recibir el cliente su pedido. La fecha se guardará en Dolibarr y
            permitirá medir la puntualidad.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">
          Fecha prevista de entrega
          <Input
            aria-label="Fecha prevista de entrega"
            type="date"
            min={seleccion?.fecha ?? undefined}
            value={pending?.fecha ?? fecha}
            disabled={!!pending || busy}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Podrás cambiarla mientras el pedido no esté confirmado como entregado. Cada cambio queda
          registrado.
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
            ? "Guardando fecha…"
            : pending
              ? "Reintentar confirmación"
              : "Guardar fecha prevista"}
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
