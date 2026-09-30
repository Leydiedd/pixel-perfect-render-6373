import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import {
  familias,
  formatoMoneda,
  precioPorVolumen,
  productos,
  type Familia,
} from "@/data/catalogo";
import { usePedido } from "@/context/pedido";
import { ProductoImagen } from "@/components/ProductoImagen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catálogo mayorista — Bimbo Mayorista" },
      {
        name: "description",
        content:
          "Catálogo por SKU con precios por volumen, stock de planta y pedidos mínimos por paleta para supermercados.",
      },
      { property: "og:title", content: "Catálogo mayorista — Bimbo Mayorista" },
      {
        property: "og:description",
        content: "Busca por SKU, revisa precios por volumen y arma tu pedido al por mayor.",
      },
    ],
  }),
  component: Catalogo,
});

function Catalogo() {
  const [consulta, setConsulta] = useState("");
  const [familia, setFamilia] = useState<Familia | "Todas">("Todas");
  const { agregar, alertas } = usePedido();

  const resultados = useMemo(() => {
    const texto = consulta.trim().toLowerCase();
    return productos.filter((p) => {
      const coincideFamilia = familia === "Todas" || p.familia === familia;
      const coincideTexto =
        !texto || p.nombre.toLowerCase().includes(texto) || p.sku.toLowerCase().includes(texto);
      return coincideFamilia && coincideTexto;
    });
  }, [consulta, familia]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <section className="mb-10 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Abastecimiento para retail
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            Catálogo mayorista por SKU
          </h1>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar por nombre o código SKU (ej. BIM-PB-680)"
              aria-label="Buscar productos por nombre o SKU"
              className="h-12 pl-10"
            />
          </div>
        </div>
      </section>

      <div className="mb-8 flex flex-wrap gap-2">
        {(["Todas", ...familias] as const).map((f) => (
           <Button
            key={f}
            onClick={() => setFamilia(f)}
             variant={f === familia ? "default" : "outline"}
             className="rounded-sm"
          >
            {f}
           </Button>
        ))}
      </div>

      {resultados.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          No hay productos que coincidan con «{consulta}».
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map((producto) => (
            <TarjetaProducto
              key={producto.sku}
              sku={producto.sku}
              onAgregar={agregar}
              alertas={alertas}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaProducto({
  sku,
  onAgregar,
  alertas,
}: {
  sku: string;
  onAgregar: (sku: string, planchas: number) => void;
  alertas: (sku: string, planchas: number) => string[];
}) {
   const producto = productos.find((p) => p.sku === sku);
   if (!producto) return null;
  const [planchas, setPlanchas] = useState(producto.minimoPlanchas);
  const avisos = alertas(producto.sku, planchas);
  const precio = precioPorVolumen(producto, planchas);

  return (
    <Card className="flex flex-col overflow-hidden border-border p-0">
      <Link
        to="/producto/$sku"
        params={{ sku: producto.sku }}
        className="block aspect-[4/3] overflow-hidden bg-muted"
      >
        <ProductoImagen
          src={producto.imagenes[0]}
          alt={producto.nombre}
          className="size-full transition-transform duration-300 hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {producto.sku}
          </p>
          <Link
            to="/producto/$sku"
            params={{ sku: producto.sku }}
            className="mt-1 block text-base font-semibold leading-snug text-foreground hover:text-primary"
          >
            {producto.nombre}
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            {producto.unidadesPorPlancha} unidades por plancha · {producto.planchasPorPaleta}{" "}
            planchas por paleta
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-foreground">{formatoMoneda(precio)}</span>
            <span className="text-xs text-muted-foreground">por plancha</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`cant-${producto.sku}`}>
              Planchas de {producto.nombre}
            </label>
            <Input
              id={`cant-${producto.sku}`}
              type="number"
              min={0}
              value={planchas}
              onChange={(e) => setPlanchas(Number(e.target.value))}
              className="h-10 w-24"
            />
            <Button
              className="flex-1"
              disabled={avisos.length > 0 || planchas <= 0}
              onClick={() => {
                onAgregar(producto.sku, planchas);
                toast.success(`${planchas} planchas de ${producto.nombre} añadidas al pedido`);
              }}
            >
              Añadir al pedido
            </Button>
          </div>

          {avisos.map((aviso) => (
            <p
              key={aviso}
              className="flex items-start gap-2 rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {aviso}
            </p>
          ))}
        </div>
      </div>
    </Card>
  );
}
