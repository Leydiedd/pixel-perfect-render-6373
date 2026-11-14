import { useEffect, useRef } from "react";
import { toast } from "sonner";
const flashKey = "bimbo-ui-flash-v1";
export function recordarAviso(message: string) {
  try {
    sessionStorage.setItem(flashKey, JSON.stringify({ message, at: Date.now() }));
  } catch {}
}
export function consumirAviso() {
  try {
    const value = sessionStorage.getItem(flashKey);
    sessionStorage.removeItem(flashKey);
    if (!value) return null;
    const v = JSON.parse(value);
    return typeof v.message === "string" && Date.now() - v.at < 15000 ? v.message : null;
  } catch {
    return null;
  }
}
export function useAvisoError(error: string) {
  const anterior = useRef("");
  useEffect(() => {
    if (error && error !== anterior.current)
      toast.error("No se pudo completar la acción", { description: error, duration: 8000 });
    anterior.current = error;
  }, [error]);
}
export async function actualizarConAviso<T extends { isError: boolean }>(
  refetch: () => Promise<T>,
) {
  try {
    const result = await refetch();
    if (result.isError)
      toast.error("No se pudo actualizar", {
        description: "Puedes reintentar. Conservamos la última información disponible.",
      });
    else toast.success("Información actualizada");
  } catch {
    toast.error("No se pudo actualizar. Reintenta en unos momentos.");
  }
}
