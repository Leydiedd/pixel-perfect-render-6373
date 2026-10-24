import React, { useState } from "react";
import { AlertTriangle, Paperclip, Smartphone, X } from "lucide-react";
import yapeQrAsset from "@/assets/yape-qr.png.asset.json";

interface SimuladorYapeModalProps {
  monto: number;
  ordenId: string;
  onClose: () => void;
  onPagoExitoso: (ordenId: string, nroOperacion: string, comprobante: File) => void;
}

export const SimuladorYapeModal: React.FC<SimuladorYapeModalProps> = ({
  monto,
  ordenId,
  onClose,
  onPagoExitoso,
}) => {
  const [nroOperacion, setNroOperacion] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [error, setError] = useState("");

  const enviar = () => {
    if (!nroOperacion.trim()) {
      setError("Ingresa el número de operación que aparece en tu voucher.");
      return;
    }
    if (!comprobante) {
      setError("Adjunta la captura de tu voucher para continuar.");
      return;
    }
    setError("");
    onPagoExitoso(ordenId, nroOperacion.trim(), comprobante);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-fade-in relative w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={24} />
        </button>

        <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
          <div className="rounded-full bg-yape-soft p-3">
            <Smartphone className="size-8 text-yape" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Verificación de pago B2B</h2>
            <p className="text-muted-foreground">Orden #{ordenId.slice(-6)}</p>
          </div>
        </div>

        <div className="text-center">
          <p className="mb-4 text-3xl font-bold text-yape">S/ {monto.toFixed(2)}</p>

          <div className="mx-auto mb-4 w-64 rounded-2xl bg-yape p-3 shadow-lg">
            <img
              src={yapeQrAsset.url}
              alt="Código QR de pago de Panaderías Bimbo Osito"
              className="w-full rounded-xl"
            />
          </div>

          <p className="mx-auto mb-5 max-w-xs text-sm text-muted-foreground">
            Escanea el código QR para transferir el importe exacto a Panaderías Bimbo Osito.
          </p>

          <div className="mb-6 flex items-center justify-center gap-3 rounded-xl bg-muted p-4 text-foreground">
            <span className="text-sm">A nombre de:</span>
            <span className="font-semibold">Panaderías Bimbo Osito</span>
            <span className="rounded bg-yape px-2 py-0.5 text-xs font-bold text-yape-foreground">
              B2B
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="nro-operacion"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Número de Operación
            </label>
            <input
              id="nro-operacion"
              type="text"
              required
              value={nroOperacion}
              onChange={(e) => {
                setNroOperacion(e.target.value);
                setError("");
              }}
              placeholder="Ej: 000123456"
              className="w-full rounded-xl border-2 border-input px-4 py-3 font-mono tracking-wider transition focus:border-yape focus:ring-4 focus:ring-yape/15 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Captura del voucher
            </span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-yape-border bg-yape-soft px-4 py-3 text-sm transition-colors hover:border-yape">
              <Paperclip className="size-4 shrink-0 text-yape" aria-hidden />
              <span className="truncate text-muted-foreground">
                {comprobante ? comprobante.name : "Adjuntar captura del voucher"}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  setComprobante(e.target.files?.[0] ?? null);
                  setError("");
                }}
              />
            </label>
          </div>

          {error && (
            <p className="animate-shake flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle size={16} aria-hidden />
              {error}
            </p>
          )}

          <button
            onClick={enviar}
            className="w-full rounded-xl bg-yape py-4 text-lg font-semibold text-yape-foreground shadow-md transition-colors hover:bg-yape/90"
          >
            Enviar Comprobante y Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
