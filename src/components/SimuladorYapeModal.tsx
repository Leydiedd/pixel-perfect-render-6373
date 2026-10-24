import { useState, ChangeEvent, FormEvent } from "react";
import { X, Upload, CheckCircle2, QrCode, CreditCard, Lock, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoMoneda } from "@/data/catalogo";

interface SimuladorYapeModalProps {
  monto: number;
  ordenId: string;
  onClose: () => void;
  onPagoExitoso: (ordenId: string, nroOperacion: string) => void;
}

export function SimuladorYapeModal({
  monto,
  ordenId,
  onClose,
  onPagoExitoso,
}: SimuladorYapeModalProps) {
  const [metodoPago, setMetodoPago] = useState<"yape" | "tarjeta">("yape");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  // Estado para Yape
  const [nroOperacion, setNroOperacion] = useState("");
  const [archivoVoucher, setArchivoVoucher] = useState<File | null>(null);

  // Estado para Tarjeta
  const [nroTarjeta, setNroTarjeta] = useState("");
  const [expiracion, setExpiracion] = useState("");
  const [cvv, setCvv] = useState("");
  const [titular, setTitular] = useState("");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArchivoVoucher(e.target.files[0]);
      setError("");
    }
  };

  const handleFormatoTarjeta = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formateado = v.replace(/(.{4})/g, "$1 ").trim();
    setNroTarjeta(formateado);
    setError("");
  };

  const handleFormatoExpiracion = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 2) {
      setExpiracion(`${v.slice(0, 2)}/${v.slice(2)}`);
    } else {
      setExpiracion(v);
    }
    setError("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (metodoPago === "yape") {
      if (!nroOperacion.trim()) {
        setError("Ingresa el número de operación del voucher.");
        return;
      }
      if (!archivoVoucher) {
        setError("Adjunta la captura del comprobante.");
        return;
      }
    } else {
      if (nroTarjeta.replace(/\s/g, "").length < 16) {
        setError("Ingresa un número de tarjeta válido de 16 dígitos.");
        return;
      }
      if (expiracion.length < 5) {
        setError("Ingresa una fecha de vencimiento válida (MM/AA).");
        return;
      }
      if (cvv.length < 3) {
        setError("Ingresa el código CVV de 3 dígitos.");
        return;
      }
      if (!titular.trim()) {
        setError("Ingresa el nombre del titular de la tarjeta.");
        return;
      }
    }

    setProcesando(true);
    setError("");

    // Simulación de procesamiento de la pasarela en 1.5 segundos
    setTimeout(() => {
      setProcesando(false);
      const codigoGenerado = metodoPago === "yape" 
        ? nroOperacion.trim() 
        : `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;
      
      onPagoExitoso(ordenId, codigoGenerado);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-6 text-emerald-600" />
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
            Pasarela de Pago Segura
          </h2>
          <p className="text-xs text-muted-foreground">
            Orden <span className="font-mono font-medium text-foreground">#{ordenId.slice(-6)}</span> · Cifrado SSL 256-bit
          </p>
        </div>

        {/* Resumen de Monto */}
        <div className="mt-4 rounded-xl bg-muted/60 p-3.5 text-center border border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Monto a procesar
          </p>
          <p className="text-2xl font-extrabold text-foreground">
            {formatoMoneda(monto)}
          </p>
        </div>

        {/* Selector de Método de Pago */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => { setMetodoPago("yape"); setError(""); }}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
              metodoPago === "yape"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="size-4" />
            Yape
          </button>

          <button
            type="button"
            onClick={() => { setMetodoPago("tarjeta"); setError(""); }}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
              metodoPago === "tarjeta"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="size-4" />
            Tarjeta Deb/Cred
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {metodoPago === "yape" ? (
            <>
              <div className="flex flex-col items-center justify-center rounded-xl border border-border p-3 bg-card">
                <img
                  src="/qr-yape.jpg"
                  alt="Código QR Yape Bimbo Mayorista"
                  className="w-36 rounded-lg object-cover shadow-sm"
                  onError={(e) => {
                    e.currentTarget.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=BimboYapeMayorista";
                  }}
                />
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Escanea con tu App de Yape a <strong>Panadería Bimbo S.A.C.</strong>
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="nroOp" className="text-xs font-medium">
                  Número de Operación (8 dígitos)
                </Label>
                <Input
                  id="nroOp"
                  type="text"
                  placeholder="Ej. 18920482"
                  value={nroOperacion}
                  onChange={(e) => { setNroOperacion(e.target.value); setError(""); }}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="voucher" className="text-xs font-medium">
                  Comprobante (Voucher)
                </Label>
                <div className="relative flex items-center justify-center rounded-lg border border-dashed border-border p-2.5 text-center transition-colors hover:bg-muted/50">
                  <input
                    id="voucher"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {archivoVoucher ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span className="font-medium text-foreground truncate max-w-[200px]">
                          {archivoVoucher.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        <span>Adjuntar voucher o captura</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="titular" className="text-xs font-medium">
                  Nombre del Titular
                </Label>
                <Input
                  id="titular"
                  type="text"
                  placeholder="Ej. LEYDI ROJAS CHAVEZ"
                  value={titular}
                  onChange={(e) => { setTitular(e.target.value.toUpperCase()); setError(""); }}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tarjeta" className="text-xs font-medium">
                  Número de Tarjeta (Visa / Mastercard)
                </Label>
                <div className="relative">
                  <Input
                    id="tarjeta"
                    type="text"
                    placeholder="4557 8800 1234 5678"
                    value={nroTarjeta}
                    onChange={handleFormatoTarjeta}
                    className="h-9 text-xs pr-8 font-mono"
                  />
                  <CreditCard className="absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="expiracion" className="text-xs font-medium">
                    Expiración (MM/AA)
                  </Label>
                  <Input
                    id="expiracion"
                    type="text"
                    placeholder="08/28"
                    value={expiracion}
                    onChange={handleFormatoExpiracion}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cvv" className="text-xs font-medium">
                    CVV
                  </Label>
                  <div className="relative">
                    <Input
                      id="cvv"
                      type="password"
                      maxLength={4}
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => { setCvv(e.target.value.replace(/\D/g, "")); setError(""); }}
                      className="h-9 text-xs font-mono"
                    />
                    <Lock className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 p-2 text-center text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={procesando}
            className={`w-full font-medium text-white transition-all ${
              metodoPago === "yape"
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            size="lg"
          >
            {procesando ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Procesando pago con la pasarela...</span>
              </div>
            ) : (
              `Pagar ${formatoMoneda(monto)} ahora`
            )}
          </Button>

          <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="size-3" />
            Pagos procesados de forma segura con cifrado bancario
          </p>
        </form>
      </div>
    </div>
  );
}