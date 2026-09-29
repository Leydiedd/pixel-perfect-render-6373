import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, Layers, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { buscarProducto, formatoFecha, formatoMoneda, precioPorVolumen } from "@/data/catalogo";
import { usePedido } from "@/context/pedido";
import { ProductoImagen } from "@/components/ProductoImagen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/producto/$sku")({
  loader: ({ params }) => {
    const producto = buscarProducto(params.sku);
    if (!producto) throw notFound();
    return { producto };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Producto no disponible — Bimbo Mayorista" }, { name: "robots", content: "noindex" }],
      };
    }
    const { producto } = loaderData;
    const titulo = `${producto.nombre} (${producto.sku}) — Bimbo Mayorista`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: producto.descripcion },
        { property: "og:title", content: titulo },
        { property: "og:description", content: producto.descripcion },
        { property: "og:image", content: producto.imagenes[0] },
        { name: "twitter:image", content: producto.imagenes[0] },
      ],
    };
  },
  component: FichaProducto,
});

function FichaProducto() {
  const { producto } = Route.useLoaderData();
  const { agregar, alertas } = usePedido();
  const [planchas, setPlanchas] = useState(producto.minimoPlanchas);
  const [principal, setPrincipal] = useState(0);

  const avisos = alertas(producto.sku, planchas);
  const precio = precioPorVolumen(producto, planchas);
  const paletas = planchas / producto.planchasPorPaleta;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al catálogo
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
            <ProductoImagen
              src={producto.imagenes[principal]}
              alt={producto.nombre}
              className="size-full"
            />
          </div>
          <div className="flex gap-3">
            {producto.imagenes.map((url, i) => (
              <button
                key={url}
                onClick={() => setPrincipal(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={
                  i === principal
                    ? "size-20 overflow-hidden rounded-lg border-2 border-primary"
                    : "size-20 overflow-hidden rounded-lg border border-border opacity-70 hover:opacity-100"
                }
              >
                <ProductoImagen src={url} alt="" className="size-full" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            SKU {producto.sku} · {producto.familia}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {producto.nombre}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{producto.descripcion}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-background p-5 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Unidades por plancha</dt>
              <dd className="font-semibold text-foreground">{producto.unidadesPorPlancha}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Planchas por paleta</dt>
              <dd className="font-semibold text-foreground">{producto.planchasPorPaleta}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pedido mínimo</dt>
              <dd className="font-semibold text-foreground">{producto.minimoPlanchas} planchas</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Stock de planta</dt>
              <dd className="font-semibold text-foreground">{producto.stockPlanchas} planchas</dd>
            </div>
          </dl>

          <Card className="mt-6 gap-0 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="size-4 text-primary" aria-hidden />
              Precio por volumen
            </h2>
            <ul className="mt-3 divide-y divide-border text-sm">
              {producto.precios.map((escala) => (
                <li key={escala.desdePlanchas} className="flex justify-between py-2">
                  <span className="text-muted-foreground">
                    Desde {escala.desdePlanchas} plancha{escala.desdePlanchas > 1 ? "s" : ""}
                  </span>
                  <span className="font-semibold text-foreground">{formatoMoneda(escala.precio)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="mt-6 gap-0 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              Lotes disponibles
            </h2>
            <ul className="mt-3 divide-y divide-border text-sm">
              {producto.lotes.map((lote) => (
                <li key={lote.lote} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-muted-foreground">{lote.lote}</span>
                  <span className="text-muted-foreground">Caduca {formatoFecha(lote.caducidad)}</span>
                  <span className="font-semibold text-foreground">{lote.planchas} planchas</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="mt-6 rounded-xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="planchas" className="text-xs text-muted-foreground">
                  Planchas
                </label>
                <Input
                  id="planchas"
                  type="number"
                  min={0}
                  value={planchas}
                  onChange={(e) => setPlanchas(Number(e.target.value))}
                  className="mt-1 h-11 w-28"
                />
              </div>
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">Equivale a</p>
                <p className="font-semibold text-foreground">
                  {paletas.toFixed(2)} paletas · {planchas * producto.unidadesPorPlancha} unidades
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Importe estimado</p>
                <p className="text-xl font-semibold text-foreground">
                  {formatoMoneda(precio * Math.max(planchas, 0))}
                </p>
              </div>
            </div>

            {avisos.map((aviso) => (
              <p
                key={aviso}
                className="mt-3 flex items-start gap-2 rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {aviso}
              </p>
            ))}

            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={avisos.length > 0 || planchas <= 0}
              onClick={() => {
                agregar(producto.sku, planchas);
                toast.success(`${planchas} planchas añadidas al pedido`);
              }}
            >
              <PackageSearch className="size-4" aria-hidden />
              Añadir al pedido
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
