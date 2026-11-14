import { useEffect, useState } from "react";
import { toast } from "sonner";
import { consumirAviso } from "@/lib/ux-feedback";
export function EstadoConexion() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const message = consumirAviso();
    if (message) toast.success(message);
    setOffline(!navigator.onLine);
    const off = () => setOffline(true);
    const on = () => {
      setOffline(false);
      toast.info("Conexión recuperada", {
        description: "Actualiza la información antes de continuar.",
      });
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  return offline ? (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
    >
      Sin conexión. Conserva esta página abierta; si enviaste un pedido o pago, espera y reintenta
      la misma operación para consultar su resultado.
    </div>
  ) : null;
}
