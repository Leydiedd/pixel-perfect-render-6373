import { prepararRepeticion } from "@/lib/order-experience";
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Catalogo, Sesion } from "@/lib/store-model";
export async function jsonApi(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}
export const storeHeaders = { "Content-Type": "application/json", "X-Bimbo-Request": "store" };
export function useSesion() {
  return useQuery<{ sesion: Sesion | null }>({
    queryKey: ["sesion"],
    queryFn: () => jsonApi("/api/sesion"),
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
type Cart = { id: number; cantidad: number }[];
const Ctx = createContext<null | {
  canal: "b2b" | "b2c";
  cambiarCanal: (v: "b2b" | "b2c") => void;
  carrito: Cart;
  cantidad: (id: number, n: number) => void;
  vaciar: () => void;
  repetir: (
    lineas: { productoId?: number; nombre: string; cantidad: number }[],
    catalogo: Catalogo,
  ) => ReturnType<typeof prepararRepeticion>;
  listo: boolean;
}>(null);
export function TiendaProvider({ children }: { children: ReactNode }) {
  const session = useSesion();
  const owner = String(session.data?.sesion?.id ?? "visitante");
  const [selection, setSelection] = useState<{ owner: string; canal: "b2b" | "b2c" } | null>(null);
  const selected =
    selection?.owner === owner ? selection.canal : session.data?.sesion?.canal || "b2c";
  const canal = session.data?.sesion?.canal === "b2c" ? "b2c" : selected;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bimbo-tienda-canal-${owner}`);
      if (saved === "b2b" || saved === "b2c") setSelection({ owner, canal: saved });
    } catch {}
  }, [owner]);
  const [carrito, setCart] = useState<Cart>([]);
  const cartRef = useRef(carrito);
  cartRef.current = carrito;
  const [listo, setListo] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bimbo-tienda-cart-v1") || "[]");
      if (Array.isArray(saved))
        setCart(
          saved
            .filter(
              (v) =>
                Number.isInteger(v.id) &&
                v.id > 0 &&
                Number.isInteger(v.cantidad) &&
                v.cantidad > 0,
            )
            .slice(0, 100),
        );
    } catch {}
    setListo(true);
  }, []);
  const save = (next: Cart) => {
    cartRef.current = next;
    setCart(next);
    try {
      localStorage.setItem("bimbo-tienda-cart-v1", JSON.stringify(next));
    } catch {}
  };
  return (
    <Ctx.Provider
      value={{
        canal,
        cambiarCanal: (v) => {
          if (session.data?.sesion?.canal === "b2c" && v === "b2b") return;
          setSelection({ owner, canal: v });
          try {
            localStorage.setItem(`bimbo-tienda-canal-${owner}`, v);
          } catch {}
        },
        carrito,
        cantidad: (id, n) =>
          save([
            ...carrito.filter((v) => v.id !== id),
            ...(n > 0 ? [{ id, cantidad: Math.min(1000000, Math.floor(n)) }] : []),
          ]),
        vaciar: () => save([]),
        repetir: (lineas, catalogo) => {
          const result = prepararRepeticion(cartRef.current, lineas, catalogo);
          save(result.carrito);
          return result;
        },
        listo,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useTienda() {
  const c = useContext(Ctx);
  if (!c) throw new Error("TiendaProvider requerido");
  return c;
}
export function useCatalogo() {
  const { canal, listo } = useTienda();
  const session = useSesion();
  return useQuery<Catalogo>({
    queryKey: [
      "tienda",
      "catalogo",
      canal,
      session.data?.sesion?.id ?? null,
      session.data?.sesion?.nivelTarifa,
    ],
    queryFn: () => jsonApi(`/api/tienda?canal=${canal}`),
    enabled: listo && session.isSuccess,
    staleTime: 10000,
    refetchInterval: 30000,
    retry: 1,
  });
}
