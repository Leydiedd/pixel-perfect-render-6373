import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { jsonApi, useTienda } from "@/context/tienda";
import type { Catalogo, Cuenta } from "@/lib/store-model";
import { textoPago } from "@/lib/order-experience";
import { formatoMoneda } from "@/lib/dolibarr-model";
import { Button } from "./ui/button";
export function AccionesPedidoCliente({
  pedido,
  cuenta,
  pagar,
  historial,
}: {
  pedido: Cuenta["pedidos"][number];
  cuenta: Cuenta;
  pagar: (id: number) => void;
  historial: () => void;
}) {
  const { canal, repetir } = useTienda();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ avisos: string[]; unidades: number } | null>(null);
  const [error, setError] = useState("");
  useAvisoError(error);
  const p = pedido.pago;
  const facturas = cuenta.facturas.filter(
    (f) => p?.facturas.some((v) => v.id === f.id) && f.pagoDemoPermitido,
  );
  async function repeat() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const catalogo: Catalogo = await jsonApi(`/api/tienda?canal=${canal}`);
      const r = repetir(pedido.lineas, catalogo);
      setResult(r);
      if (r.unidades)
        toast.success("Productos añadidos al carrito", {
          description: "Revisa las cantidades y precios actuales antes de confirmar.",
        });
      else
        toast.info("No se añadieron productos", {
          description: "Revisa los avisos de disponibilidad del pedido.",
        });
      void qc.invalidateQueries({ queryKey: ["tienda", "catalogo"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el catálogo.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${p?.estado === "pagado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
          >
            {p ? textoPago[p.estado] : "Consultando pago"}
          </span>
          {p && p.saldo > 0 && p.estado !== "cancelado" && (
            <p className="mt-2 text-sm">
              Saldo pendiente: <strong>{formatoMoneda(p.saldo, cuenta.moneda)}</strong>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {pedido.estado !== -1 &&
            facturas.map((f) => (
              <Button key={f.id} size="sm" onClick={() => pagar(f.id)}>
                {facturas.length === 1 ? "Pagar pedido" : `Pagar ${f.ref}`}
              </Button>
            ))}
          <Button variant="outline" size="sm" onClick={historial}>
            Ver historial
          </Button>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void repeat()}>
            {loading ? "Consultando stock…" : "Repetir pedido"}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="text-sm">
          <p>
            {result.unidades
              ? `${result.unidades} unidades añadidas con la disponibilidad actual. El carrito recalcula precios e IGV y aplica el mínimo mayorista vigente.`
              : "No se añadieron productos."}
          </p>
          {result.avisos.length > 0 && (
            <ul className="my-2 list-inside list-disc">
              {result.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
          {result.unidades > 0 && (
            <Link to="/carrito" className="font-semibold text-primary underline">
              Revisar carrito →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
