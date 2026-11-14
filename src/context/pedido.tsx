import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useDolibarr } from "@/context/dolibarr";
import { nuevoPedidoSchema, type NuevoPedido } from "@/lib/order-model";
export type LineaPedido = { sku: string; planchas: number };
type ContextoPedido = {
  lineas: LineaPedido[];
  agregar: (sku: string, cantidad: number) => void;
  fijar: (sku: string, cantidad: number) => void;
  quitar: (sku: string) => void;
  vaciar: () => void;
  totalImporte: number;
  totalPlanchas: number;
  pendiente: NuevoPedido | null;
  guardarPendiente: (pedido: NuevoPedido) => void;
  resolverPendiente: (creado: boolean) => void;
  bloqueado: boolean;
};
const Ctx = createContext<ContextoPedido | null>(null);
const KEY = "bimbo-dolibarr-borrador-v2";
const PENDING_KEY = "bimbo-dolibarr-envio-v1";
export function ProveedorPedido({ children }: { children: ReactNode }) {
  const { datos } = useDolibarr();
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pendiente, setPendiente] = useState<NuevoPedido | null>(null);
  const pendienteRef = useRef<NuevoPedido | null>(null);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(saved))
        setLineas(
          saved.filter(
            (l): l is LineaPedido =>
              typeof l?.sku === "string" &&
              typeof l.planchas === "number" &&
              Number.isFinite(l.planchas) &&
              l.planchas > 0,
          ),
        );
    } catch {
      /* A corrupted local draft never affects Dolibarr. */
    }
    try {
      const saved = nuevoPedidoSchema.safeParse(
        JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null"),
      );
      if (saved.success) {
        pendienteRef.current = saved.data;
        setPendiente(saved.data);
      }
    } catch {
      /* No request is sent automatically. */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(KEY, JSON.stringify(lineas));
      } catch {
        /* Storage may be disabled. */
      }
    }
  }, [lineas, hydrated]);
  const fijar = (sku: string, cantidad: number) => {
    if (!hydrated || pendienteRef.current) return;
    if (!Number.isFinite(cantidad) || cantidad < 0) return;
    setLineas((prev) =>
      cantidad === 0
        ? prev.filter((l) => l.sku !== sku)
        : prev.some((l) => l.sku === sku)
          ? prev.map((l) => (l.sku === sku ? { sku, planchas: cantidad } : l))
          : [...prev, { sku, planchas: cantidad }],
    );
  };
  const agregar = (sku: string, cantidad: number) => {
    if (!hydrated || pendienteRef.current) return;
    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
    setLineas((prev) => {
      const found = prev.find((l) => l.sku === sku);
      return found
        ? prev.map((l) => (l.sku === sku ? { ...l, planchas: l.planchas + cantidad } : l))
        : [...prev, { sku, planchas: cantidad }];
    });
  };
  const totalImporte = lineas.reduce(
    (sum, l) => sum + l.planchas * (datos.productos.find((p) => p.sku === l.sku)?.precio ?? 0),
    0,
  );
  return (
    <Ctx.Provider
      value={{
        lineas,
        fijar,
        agregar,
        quitar: (sku) => {
          if (hydrated && !pendienteRef.current)
            setLineas((prev) => prev.filter((l) => l.sku !== sku));
        },
        vaciar: () => {
          if (hydrated && !pendienteRef.current) setLineas([]);
        },
        pendiente,
        bloqueado: !hydrated || !!pendiente,
        guardarPendiente: (pedido) => {
          if (pendienteRef.current) throw new Error("Resuelve primero el envío pendiente.");
          // Persist before sending so a reload cannot turn a retry into a duplicate.
          localStorage.setItem(PENDING_KEY, JSON.stringify(pedido));
          pendienteRef.current = pedido;
          setPendiente(pedido);
        },
        resolverPendiente: (creado) => {
          // Clear the cart first. If storage fails, the same request remains recoverable.
          if (creado) {
            localStorage.setItem(KEY, "[]");
            setLineas([]);
          }
          localStorage.removeItem(PENDING_KEY);
          pendienteRef.current = null;
          setPendiente(null);
        },
        totalImporte,
        totalPlanchas: lineas.reduce((n, l) => n + l.planchas, 0),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function usePedido() {
  const value = useContext(Ctx);
  if (!value) throw new Error("ProveedorPedido requerido");
  return value;
}
