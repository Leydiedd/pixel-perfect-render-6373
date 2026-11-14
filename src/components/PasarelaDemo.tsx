import { BotonFacturaPdf } from "./BotonFacturaPdf";
import { crearSolicitudId } from "@/lib/solicitud-id";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import {
  CreditCard,
  Smartphone,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storeHeaders } from "@/context/tienda";
import type { Cuenta } from "@/lib/store-model";
import { formatoMoneda } from "@/lib/dolibarr-model";
import {
  pagoClienteSchema,
  resultadoPagoClienteSchema,
  nombresMetodo,
  type PagoCliente,
  type ResultadoPagoCliente,
  type MetodoDemo,
} from "@/lib/customer-payment-model";

export function PasarelaDemo({
  userId,
  facturaId,
  cuenta,
  cerrar,
  actualizar,
}: {
  userId: number;
  facturaId: number | null;
  cuenta: Cuenta;
  cerrar: () => void;
  actualizar: () => void;
}) {
  const [metodo, setMetodo] = useState<MetodoDemo>("tarjeta");
  const [paso, setPaso] = useState<"metodo" | "confirmar">("metodo");
  const [codigo, setCodigo] = useState("");
  const [aceptado, setAceptado] = useState(false);
  const [pending, setPending] = useState<PagoCliente | null>(null);
  const [result, setResult] = useState<ResultadoPagoCliente | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const sending = useRef(false);
  const key = `bimbo-demo-payment-v1-${userId}`;
  const id = pending?.facturaId ?? result?.factura.id ?? facturaId;
  const factura = cuenta.facturas.find((f) => f.id === id);
  const amount = pending?.saldoEsperado ?? result?.pago.importe ?? factura?.saldo ?? 0;
  const selected = pending?.metodo ?? result?.metodo ?? metodo;
  const money = (v: number) => formatoMoneda(v, cuenta.moneda);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      const parsed = pagoClienteSchema.safeParse(saved);
      if (parsed.success) {
        setPending(parsed.data);
        setMetodo(parsed.data.metodo);
        setPaso("confirmar");
        setAceptado(true);
      }
    } catch {}
  }, [key]);
  useEffect(() => {
    if (facturaId) setHidden(false);
    if (facturaId && !pending) {
      setMetodo("tarjeta");
      setPaso("metodo");
      setCodigo("");
      setAceptado(false);
      setError("");
      setResult(null);
    }
  }, [facturaId]);
  function close() {
    if (busy) return;
    setHidden(true);
    setResult(null);
    setError("");
    if (!pending) setPaso("metodo");
    cerrar();
  }
  function review() {
    setError("");
    if (!factura?.pagoDemoPermitido) {
      setError("Actualiza la factura para comprobar su saldo y disponibilidad.");
      actualizar();
      return;
    }
    if (metodo !== "tarjeta" && codigo !== "123456") {
      setError("Ingresa el código de confirmación 123456.");
      return;
    }
    setPaso("confirmar");
  }
  async function pay() {
    if (sending.current || (!pending && !aceptado)) return;
    if (!pending && !factura?.pagoDemoPermitido) {
      setError("La factura cambió. Actualiza su estado antes de pagar.");
      actualizar();
      return;
    }
    const parsed = pagoClienteSchema.safeParse(
      pending ?? { solicitudId: crearSolicitudId(), facturaId: id, metodo, saldoEsperado: amount },
    );
    if (!parsed.success) {
      setError("Actualiza el saldo antes de continuar.");
      return;
    }
    const payload = parsed.data;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      setPending(payload);
      const response = await fetch("/api/pago-cliente", {
        method: "POST",
        headers: storeHeaders,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(50_000),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.revisable === true) {
          localStorage.removeItem(key);
          setPending(null);
          setPaso("metodo");
          setAceptado(false);
          actualizar();
        }
        setError(body.error || "No se pudo confirmar el pago.");
        return;
      }
      const receipt = resultadoPagoClienteSchema.parse(body);
      toast.success("Pago registrado correctamente", {
        description: "Ya puedes consultar el saldo actualizado de tu factura.",
      });
      localStorage.removeItem(key);
      setPending(null);
      setResult(receipt);
      actualizar();
    } catch {
      setError(
        "No se pudo confirmar el resultado. Reintenta el mismo pago para recuperarlo sin duplicarlo. Si el almacenamiento está bloqueado, habilítalo antes de continuar.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const open = !!facturaId || (!!pending && !hidden) || !!result;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent
        className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto rounded-3xl border-0 bg-[#faf8f4] p-0 text-[#20344e]"
        onEscapeKeyDown={(e) => {
          if (busy || pending) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy || pending) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b bg-white px-6 pb-5 pt-6 sm:px-8">
          <DialogTitle className="text-2xl">
            {result ? "Pago registrado" : "Paga tu factura"}
          </DialogTitle>
          <DialogDescription>
            Elige tu método de pago y confirma el importe de tu factura.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-5 px-6 pb-7 text-center sm:px-8">
            <CheckCircle2 className="mx-auto mt-2 size-14 text-emerald-600" />
            <p className="text-4xl font-bold">{money(result.pago.importe)}</p>
            <p className="text-sm">{nombresMetodo[result.metodo]} · Pago aprobado</p>
            <div className="rounded-2xl border bg-white p-5 text-left text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <dt>Factura</dt>
                <dd className="text-right font-semibold">{result.factura.ref}</dd>
                <dt>Comprobante</dt>
                <dd className="text-right font-semibold">{result.pago.ref}</dd>
                <dt>Saldo pendiente</dt>
                <dd className="text-right font-semibold">{money(result.factura.saldo)}</dd>
                <dt>Estado</dt>
                <dd className="text-right text-emerald-700">
                  {result.factura.pagada ? "Pagada" : "Pago registrado"}
                </dd>
              </dl>
            </div>
            <p className="text-xs text-slate-500">
              Tu pago se registró correctamente y el saldo de tu factura está actualizado.
            </p>
            {result.aviso && <p className="text-sm text-amber-800">{result.aviso}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              <BotonFacturaPdf
                url={"/api/cuenta?documento=" + result.factura.id}
                referencia={result.factura.ref}
              >
                <ReceiptText className="size-4" />
                Ver factura PDF
              </BotonFacturaPdf>
              <Button onClick={close}>Volver a mis facturas</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 px-6 pb-7 sm:px-8 md:grid-cols-[1.35fr_1fr]">
            <div className="min-w-0 space-y-5">
              <div className="flex gap-3 text-xs">
                <span className={paso === "metodo" ? "font-bold" : "text-slate-500"}>
                  1. Método
                </span>
                <ArrowRight className="size-3.5" />
                <span className={paso === "confirmar" ? "font-bold" : "text-slate-500"}>
                  2. Confirmación
                </span>
                <ArrowRight className="size-3.5" />
                <span className="text-slate-500">3. Comprobante</span>
              </div>
              {paso === "metodo" ? (
                <>
                  <div className="grid grid-cols-3 gap-2" aria-label="Método de pago">
                    {(["tarjeta", "yape", "plin"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={metodo === m}
                        onClick={() => {
                          setMetodo(m);
                          setCodigo("");
                          setError("");
                        }}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 px-2 py-4 text-sm font-semibold transition ${metodo === m ? "border-[#20344e] bg-white shadow-sm" : "border-transparent bg-slate-100 text-slate-500 hover:bg-white"}`}
                      >
                        {m === "tarjeta" ? (
                          <CreditCard className="size-6" />
                        ) : (
                          <span
                            className={`grid size-7 place-content-center rounded-lg text-white ${m === "yape" ? "bg-purple-700" : "bg-cyan-600"}`}
                          >
                            {m === "yape" ? "Y" : "P"}
                          </span>
                        )}
                        {nombresMetodo[m]}
                      </button>
                    ))}
                  </div>
                  {metodo === "tarjeta" ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-gradient-to-br from-[#20344e] to-[#46658d] p-5 text-white shadow-lg">
                        <div className="flex justify-between text-xs">
                          <span>TARJETA</span>
                          <CreditCard className="size-5" />
                        </div>
                        <p className="my-6 font-mono text-lg tracking-widest">
                          4242 4242 4242 4242
                        </p>
                        <div className="flex justify-between text-[10px] tracking-wider">
                          <span>TITULAR</span>
                          <span>12/30</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 text-xs">
                          Vencimiento
                          <Input value="12/30" readOnly aria-label="Vencimiento" />
                        </label>
                        <label className="space-y-1 text-xs">
                          Código de confirmación
                          <Input value="123" readOnly aria-label="Código de tarjeta" />
                        </label>
                      </div>
                      <p className="text-xs text-slate-500">
                        Tarjeta seleccionada para esta compra.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-2xl border bg-white p-5 text-center">
                      <div className="mx-auto w-fit rounded-xl border border-slate-200 p-2">
                        <QRCodeSVG
                          value={`BIMBO-DEMO-NO-PAGAR:${metodo}:factura-${id}`}
                          size={112}
                        />
                      </div>
                      <p className="text-sm font-semibold">{nombresMetodo[metodo]}</p>
                      <p className="text-xs text-slate-500">
                        Confirma el importe y utiliza el código indicado para continuar.
                      </p>
                      <label className="block space-y-2 text-left text-xs">
                        Código de confirmación
                        <Input
                          aria-label="Código de confirmación"
                          inputMode="numeric"
                          maxLength={6}
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                          placeholder="123456"
                          className="text-center font-mono tracking-[.4em]"
                        />
                      </label>
                      <p className="text-xs text-slate-500">
                        Escribe <strong>123456</strong> para continuar.
                      </p>
                    </div>
                  )}
                  <Button className="w-full rounded-xl" onClick={review}>
                    Continuar
                    <ArrowRight className="size-4" />
                  </Button>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border bg-white p-5">
                    <p className="text-xs text-slate-500">Método elegido</p>
                    <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
                      {selected === "tarjeta" ? (
                        <CreditCard className="size-5" />
                      ) : (
                        <Smartphone className="size-5" />
                      )}
                      {nombresMetodo[selected]}{" "}
                    </p>
                    <p className="mt-4 text-sm">
                      Se aplicará un pago de {money(amount)} al saldo de tu factura.
                    </p>
                  </div>
                  {!pending && (
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={aceptado}
                        onChange={(e) => setAceptado(e.target.checked)}
                        className="mt-1"
                      />
                      Confirmo el método y el importe del pago.
                    </label>
                  )}
                  {pending && !busy && (
                    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                      Hay un envío pendiente de confirmación. Recuperaremos la misma operación, sin
                      generar otro pago.
                    </p>
                  )}
                  <Button
                    disabled={busy || (!pending && !aceptado)}
                    className="w-full rounded-xl"
                    onClick={() => void pay()}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Procesando pago…
                      </>
                    ) : pending ? (
                      "Reintentar el mismo pago"
                    ) : (
                      `Confirmar pago · ${money(amount)}`
                    )}
                  </Button>
                  {!pending && !busy && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm"
                      onClick={() => setPaso("metodo")}
                    >
                      <ArrowLeft className="size-4" />
                      Cambiar método
                    </button>
                  )}
                </div>
              )}
              {error && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
            </div>
            <aside className="h-fit space-y-4 rounded-2xl border bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resumen de la factura
              </p>
              <p className="font-semibold">{factura?.ref || `Factura #${id}`}</p>
              <p className="text-xs text-slate-500">{cuenta.perfil.nombre}</p>
              <dl className="space-y-3 border-y py-4 text-sm">
                <div className="flex justify-between">
                  <dt>Saldo pendiente</dt>
                  <dd>{money(amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Comisión</dt>
                  <dd>{money(0)}</dd>
                </div>
              </dl>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-xl">{money(amount)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Incluye los impuestos de la factura. El pago cubre el saldo completo.
              </p>
              <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                Podrás consultar el comprobante y el saldo actualizado en Mi cuenta.
              </div>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
