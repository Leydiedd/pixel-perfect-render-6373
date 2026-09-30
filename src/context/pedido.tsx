import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buscarProducto, precioPorVolumen, cuenta } from "@/data/catalogo";

export type LineaPedido = { sku: string; planchas: number };

type PedidoContexto = {
  lineas: LineaPedido[];
  totalPlanchas: number;
  totalImporte: number;
  creditoDisponible: number;
  agregar: (sku: string, planchas: number) => void;
  fijar: (sku: string, planchas: number) => void;
  quitar: (sku: string) => LineaPedido | undefined;
  restaurar: (linea: LineaPedido, indice?: number) => void;
  reemplazar: (lineas: LineaPedido[]) => void;
  vaciar: () => void;
  alertas: (sku: string, planchas: number) => string[];
};

const Ctx = createContext<PedidoContexto | null>(null);
const CLAVE = "bimbo-pedido-v1";

export function ProveedorPedido({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const hidratado = useRef(false);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      if (guardado) setLineas(JSON.parse(guardado) as LineaPedido[]);
    } catch {

    }
    hidratado.current = true;
  }, []);

  useEffect(() => {
    if (!hidratado.current) return;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(lineas));
    } catch {

    }
  }, [lineas]);

  const fijar = useCallback((sku: string, planchas: number) => {
    setLineas((prev) => {
      if (planchas <= 0) return prev.filter((l) => l.sku !== sku);
      const existe = prev.some((l) => l.sku === sku);
      if (!existe) return [...prev, { sku, planchas }];
      return prev.map((l) => (l.sku === sku ? { ...l, planchas } : l));
    });
  }, []);

  const agregar = useCallback((sku: string, planchas: number) => {
    if (planchas <= 0) return;
    setLineas((prev) => {
      const existe = prev.find((l) => l.sku === sku);
      if (!existe) return [...prev, { sku, planchas }];
      return prev.map((l) => (l.sku === sku ? { ...l, planchas: l.planchas + planchas } : l));
    });
  }, []);

  const quitar = useCallback(
    (sku: string) => {
      const linea = lineas.find((l) => l.sku === sku);
      setLineas((prev) => prev.filter((l) => l.sku !== sku));
      return linea;
    },
    [lineas],
  );

  const restaurar = useCallback((linea: LineaPedido, indice?: number) => {
    setLineas((prev) => {
      if (prev.some((l) => l.sku === linea.sku)) return prev;
      const copia = [...prev];
      copia.splice(indice ?? copia.length, 0, linea);
      return copia;
    });
  }, []);

  const reemplazar = useCallback((nuevas: LineaPedido[]) => setLineas(nuevas), []);
  const vaciar = useCallback(() => setLineas([]), []);

  const alertas = useCallback((sku: string, planchas: number) => {
    const producto = buscarProducto(sku);
    if (!producto) return ["SKU no encontrado en el catálogo."];
    const avisos: string[] = [];
    if (planchas > 0 && planchas < producto.minimoPlanchas) {
      avisos.push(`El pedido mínimo es de ${producto.minimoPlanchas} planchas.`);
    }
    if (planchas > producto.stockPlanchas) {
      avisos.push(`Supera el stock de planta (${producto.stockPlanchas} planchas disponibles).`);
    }
    return avisos;
  }, []);

  const { totalPlanchas, totalImporte } = useMemo(() => {
    let planchas = 0;
    let importe = 0;
    for (const linea of lineas) {
      const producto = buscarProducto(linea.sku);
      if (!producto) continue;
      planchas += linea.planchas;
      importe += precioPorVolumen(producto, linea.planchas) * linea.planchas;
    }
    return { totalPlanchas: planchas, totalImporte: importe };
  }, [lineas]);

  const creditoDisponible = cuenta.lineaCredito - cuenta.creditoUsado - totalImporte;

  const valor = useMemo(
    () => ({
      lineas,
      totalPlanchas,
      totalImporte,
      creditoDisponible,
      agregar,
      fijar,
      quitar,
      restaurar,
      reemplazar,
      vaciar,
      alertas,
    }),
    [
      lineas,
      totalPlanchas,
      totalImporte,
      creditoDisponible,
      agregar,
      fijar,
      quitar,
      restaurar,
      reemplazar,
      vaciar,
      alertas,
    ],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function usePedido() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePedido debe usarse dentro de ProveedorPedido");
  return ctx;
}
