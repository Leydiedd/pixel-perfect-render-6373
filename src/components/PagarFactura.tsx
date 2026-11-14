import { crearSolicitudId } from "@/lib/solicitud-id";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { nombrePago, nombreCuenta } from "@/lib/payment-presentation";
import { useEffect, useRef, useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import {
  nuevoPagoSchema,
  pagoCreadoSchema,
  type NuevoPago,
  type ResultadoPago,
} from "@/lib/payment-model";
import { Dinero, EnDolibarr } from "@/components/DatosReales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
const key = "bimbo-dolibarr-pago-v1";
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function PagarFactura({
  facturaId,
  cerrar,
}: {
  facturaId: number | null;
  cerrar: () => void;
}) {
  const { datos, actualizar } = useDolibarr();
  const [importe, setImporte] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [medio, setMedio] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [referencia, setReferencia] = useState("");
  const [revision, setRevision] = useState<NuevoPago | null>(null);
  const [pendiente, setPendiente] = useState<NuevoPago | null>(null);
  const [recuperado, setRecuperado] = useState<number | null>(null);
  const [resultado, setResultado] = useState<ResultadoPago | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [enviando, setEnviando] = useState(false);
  const busy = useRef(false);
  const resumen = pendiente ?? revision;
  const id = resumen?.facturaId ?? facturaId ?? recuperado;
  const factura = datos.facturas.find((f) => f.id === id);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = nuevoPagoSchema.safeParse(JSON.parse(saved));
        if (parsed.success) {
          setPendiente(parsed.data);
          setRecuperado(parsed.data.facturaId);
        }
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (facturaId && !pendiente) {
      setImporte(String(datos.facturas.find((f) => f.id === facturaId)?.saldo ?? ""));
      setCuenta("");
      setMedio("");
      setFecha(hoy());
      setReferencia("");
      setError("");
      setRevision(null);
    }
  }, [facturaId]);
  const method = datos.mediosPago.find((m) => m.id === Number(medio));
  const cuentas = datos.bancos.filter(
    (b) =>
      b.abierto &&
      b.moneda === datos.empresa.moneda &&
      (!method || (method.codigo === "LIQ") === (b.tipo === 2)),
  );
  function close() {
    if (pendiente || enviando) return;
    setResultado(null);
    setRevision(null);
    setRecuperado(null);
    setError("");
    cerrar();
  }
  function revisar() {
    setError("");
    if (!factura?.pagoPermitido) {
      setError("La factura ya no admite pagos desde la página. Actualiza y revisa su estado.");
      return;
    }
    const parsed = nuevoPagoSchema.safeParse({
      solicitudId: crearSolicitudId(),
      facturaId: id,
      importe: Number(importe),
      saldoEsperado: factura.saldo,
      cuentaId: Number(cuenta),
      medioId: Number(medio),
      fecha,
      referencia,
    });
    if (!parsed.success) {
      setError(
        "Selecciona cuenta y medio de pago, una fecha válida y un importe positivo que no supere el saldo (máximo dos decimales).",
      );
      return;
    }
    setRevision(parsed.data);
  }
  async function enviar() {
    if (!resumen || busy.current) return;
    busy.current = true;
    setEnviando(true);
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify(resumen));
      setPendiente(resumen);
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bimbo-Request": "order" },
        body: JSON.stringify(resumen),
        signal: AbortSignal.timeout(50_000),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.revisable === true) {
          localStorage.removeItem(key);
          setPendiente(null);
          setRevision(null);
          actualizar();
        }
        setError(body.error ?? "No se pudo registrar el pago.");
        return;
      }
      const success = pagoCreadoSchema.parse(body);
      toast.success("Pago registrado", {
        description: "El saldo de la factura se ha actualizado.",
      });
      localStorage.removeItem(key);
      setPendiente(null);
      setRevision(null);
      setResultado(success);
      actualizar();
    } catch {
      setError(
        "No se pudo confirmar el pago. Reintenta el mismo envío para recuperarlo sin duplicarlo. Habilita el almacenamiento del navegador si está bloqueado.",
      );
    } finally {
      busy.current = false;
      setEnviando(false);
    }
  }
  return (
    <Dialog
      open={!!facturaId || !!pendiente || !!resultado || !!recuperado}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resultado ? "Pago registrado" : `Registrar pago · ${factura?.ref ?? `Factura ${id}`}`}
          </DialogTitle>
          <DialogDescription>
            {resultado
              ? "El cobro y su movimiento de cuenta están guardados en Dolibarr."
              : "Registra un cobro que ya recibiste. Selecciona la cuenta donde ingresó el dinero y el medio utilizado."}
          </DialogDescription>
        </DialogHeader>
        {resultado ? (
          <>
            <div
              role="status"
              className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"
            >
              <p className="font-semibold">
                Pago {resultado.pago.ref} · <Dinero valor={resultado.pago.importe} />
              </p>
              <p>Cuenta: {nombreCuenta(resultado.pago.cuenta)}</p>
              <p>
                Factura {resultado.factura.ref}:{" "}
                {resultado.factura.pagada ? "Pagada" : "Pago parcial registrado"}
              </p>
              <p>
                Saldo pendiente: <Dinero valor={resultado.factura.saldo} />
              </p>
              {resultado.repetido && <p>Pago recuperado. No se registró un segundo cobro.</p>}
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <EnDolibarr ruta={`compta/paiement/card.php?id=${resultado.pago.id}`}>
                Ver pago
              </EnDolibarr>
              <EnDolibarr ruta={`compta/facture/card.php?facid=${resultado.factura.id}`}>
                Ver factura
              </EnDolibarr>
            </div>
            {resultado.aviso && <p className="text-sm">{resultado.aviso}</p>}
            <Button onClick={close}>Cerrar</Button>
          </>
        ) : resumen ? (
          <>
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <p>
                Importe recibido:{" "}
                <strong>
                  <Dinero valor={resumen.importe} />
                </strong>
              </p>
              <p>Fecha: {resumen.fecha}</p>
              <p>
                Medio: {nombrePago(datos.mediosPago.find((m) => m.id === resumen.medioId)?.nombre)}
              </p>
              <p>
                Cuenta: {nombreCuenta(datos.bancos.find((b) => b.id === resumen.cuentaId)?.nombre)}
              </p>
              <p>Referencia: {resumen.referencia || "Sin referencia"}</p>
              <p>
                Saldo después del pago: <Dinero valor={resumen.saldoEsperado - resumen.importe} />
              </p>
            </div>
            {pendiente && (
              <p className="text-sm">
                Hay un pago pendiente de confirmar. Reintenta el mismo envío para recuperar el
                resultado.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button disabled={enviando} onClick={() => void enviar()}>
                {enviando
                  ? "Registrando pago…"
                  : pendiente
                    ? "Reintentar el mismo pago"
                    : "Confirmar registro del pago"}
              </Button>
              {!pendiente && (
                <Button variant="outline" onClick={() => setRevision(null)}>
                  Editar
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">
              {factura?.cliente} · Saldo pendiente:{" "}
              <strong>
                <Dinero valor={factura?.saldo ?? 0} />
              </strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                Importe recibido
                <Input
                  aria-label="Importe recibido"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={factura?.saldo}
                  value={importe}
                  onChange={(e) => setImporte(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                Fecha del pago
                <Input
                  aria-label="Fecha del pago"
                  type="date"
                  min={factura?.fecha?.slice(0, 10)}
                  max={hoy()}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </label>
            </div>
            <label className="space-y-1 text-sm">
              Medio de pago
              <select
                aria-label="Medio de pago"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={medio}
                onChange={(e) => {
                  setMedio(e.target.value);
                  setCuenta("");
                }}
              >
                <option value="">Seleccionar medio</option>
                {datos.mediosPago.map((m) => (
                  <option key={m.id} value={m.id}>
                    {nombrePago(m.nombre)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Cuenta de destino
              <select
                aria-label="Cuenta de destino"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={cuenta}
                onChange={(e) => setCuenta(e.target.value)}
              >
                <option value="">Seleccionar cuenta o caja</option>
                {cuentas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {nombreCuenta(b.nombre)} · {b.moneda}
                  </option>
                ))}
              </select>
            </label>
            {method && !cuentas.length && (
              <p className="text-sm">
                No hay una cuenta compatible abierta. Revisa el tipo de cuenta en Dolibarr.
              </p>
            )}
            <label className="space-y-1 text-sm">
              Referencia de operación (opcional)
              <Input
                aria-label="Referencia de operación"
                maxLength={60}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </label>
            <div className="flex gap-3">
              <Button onClick={revisar}>Revisar pago</Button>
              <Button variant="outline" onClick={close}>
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
