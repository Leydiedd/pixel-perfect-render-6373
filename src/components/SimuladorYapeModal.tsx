import React, { useState } from "react";
import { AlertTriangle, Paperclip, X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-yape">
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="fixed right-5 top-5 text-yape-foreground/70 transition-colors hover:text-yape-foreground"
      >
        <X size={26} />
      </button>

      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-14">
        <p className="mb-5 text-center text-4xl font-bold text-yape-foreground">
          S/ {monto.toFixed(2)}
        </p>

        <img
          src={yapeQrAsset.url}
          alt="Código QR de pago de Panaderías Bimbo Osito"
          className="mx-auto w-full max-w-xs"
        />

        <p className="mx-auto mb-4 mt-5 max-w-xs text-center text-sm text-yape-foreground/90">
          Escanea el código QR para transferir el importe exacto a Panaderías Bimbo Osito.
        </p>

        <p className="mb-8 text-center text-sm text-yape-foreground/80">
          A nombre de:{" "}
          <span className="font-semibold text-yape-foreground">Panaderías Bimbo Osito</span>
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="nro-operacion"
              className="mb-1.5 block text-sm font-medium text-yape-foreground"
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
              className="w-full rounded-xl border border-yape-foreground/25 bg-yape-foreground/10 px-4 py-3 font-mono tracking-wider text-yape-foreground transition placeholder:text-yape-foreground/45 focus:border-yape-foreground/60 focus:bg-yape-foreground/15 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-yape-foreground">
              Captura del voucher
            </span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-yape-foreground/30 bg-yape-foreground/10 px-4 py-3 text-sm transition-colors hover:border-yape-foreground/60">
              <Paperclip className="size-4 shrink-0 text-yape-foreground" aria-hidden />
              <span className="truncate text-yape-foreground/75">
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
            <p className="flex items-center gap-2 rounded-lg bg-yape-foreground/15 px-3 py-2 text-sm text-yape-foreground">
              <AlertTriangle size={16} aria-hidden />
              {error}
            </p>
          )}

          <button
            onClick={enviar}
            className="w-full rounded-xl bg-yape-accent py-4 text-lg font-semibold text-yape-accent-foreground transition-colors hover:bg-yape-accent/90"
          >
            Enviar Comprobante y Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
