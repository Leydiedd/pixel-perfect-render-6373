import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  buscarProducto,
  cuenta,
  formatoFecha,
  formatoMoneda,
  precioPorVolumen,
} from "@/data/catalogo";
import { usePedido } from "@/context/pedido";
import { ProductoImagen } from "@/components/ProductoImagen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/pedido")({
  head: () => ({
    meta: [
      { title: "Pedido en curso — Bimbo Mayorista" },
      {
        name: "description",
        content:
          "Edita cantidades en planchas, revisa alertas de stock y pedido mínimo, y confirma el despacho.",
      },
      { property: "og:title", content: "Pedido en curso — Bimbo Mayorista" },
      {
        property: "og:description",
        content: "Resumen editable del pedido mayorista con control de crédito y entrega.",
      },
    ],
  }),
  component: PedidoEnCurso,
});

const entregaEstimada = "2026-10-03";

function PedidoEnCurso() {
  const { lineas, fijar, quitar, restaurar, totalPlanchas, totalImporte, creditoDisponible, alertas, vaciar } =
    usePedido();

  const hayBloqueos = lineas.some((l) => alertas(l.sku, l.planchas).length > 0);
  const excedeCredito = creditoDisponible < 0;

  const eliminarLinea = (sku: string) => {
    const indice = lineas.findIndex((l) => l.sku === sku);
    const linea = quitar(sku);
    if (!linea) return;
    const producto = buscarProducto(sku);
    toast(`Línea eliminada: ${producto?.nombre ?? sku}`, {
      description: `${linea.planchas} planchas retiradas del pedido.`,
      action: {
        label: "Deshacer",
        onClick: () => restaurar(linea, indice),
      },
      duration: 10000,
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pedido en curso</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Edita las cantidades directamente en la tabla. Cada línea se expresa en planchas y muestra
        su equivalencia en paletas.
      </p>

      {lineas.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-background p-12 text-center">
          <p className="text-sm text-muted-foreground">Aún no hay líneas en este pedido.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/">Ir al catálogo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pedido-rapido">Usar pedido rápido</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-navy-soft text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-3 py-3 font-medium">Planchas</th>
                  <th className="px-3 py-3 font-medium">Paletas</th>
                  <th className="px-3 py-3 font-medium">Precio</th>
                  <th className="px-3 py-3 text-right font-medium">Importe</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineas.map((linea) => {
                  const producto = buscarProducto(linea.sku);
                  if (!producto) return null;
                  const avisos = alertas(linea.sku, linea.planchas);
                  const precio = precioPorVolumen(producto, linea.planchas);
                  return (
                    <tr key={linea.sku} className="align-top">
                      <td className="px-5 py-4">
                        <div className="flex gap-3">
                          <ProductoImagen
                            src={producto.imagenes[0]}
                            alt={producto.nombre}
                            className="size-14 shrink-0 rounded-md"
                          />
                          <div>
                            <Link
                              to="/producto/$sku"
                              params={{ sku: producto.sku }}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {producto.nombre}
                            </Link>
                            <p className="font-mono text-xs text-muted-foreground">{producto.sku}</p>
                            {avisos.map((aviso) => (
                              <p
                                key={aviso}
                                className="mt-2 flex items-start gap-1.5 rounded bg-warning/15 px-2 py-1 text-xs text-warning-foreground"
                              >
                                <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                                {aviso}
                              </p>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Input
                          type="number"
                          min={0}
                          aria-label={`Planchas de ${producto.nombre}`}
                          value={linea.planchas}
                          onChange={(e) => fijar(linea.sku, Number(e.target.value))}
                          className="h-9 w-20"
                        />
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">
                        {(linea.planchas / producto.planchasPorPaleta).toFixed(2)}
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">{formatoMoneda(precio)}</td>
                      <td className="px-3 py-4 text-right font-semibold text-foreground">
                        {formatoMoneda(precio * linea.planchas)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar ${producto.nombre}`}
                          onClick={() => eliminarLinea(linea.sku)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <aside className="space-y-4 rounded-xl border border-border bg-background p-6 lg:sticky lg:top-40">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Resumen del despacho
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Líneas</dt>
                <dd className="font-medium text-foreground">{lineas.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total planchas</dt>
                <dd className="font-medium text-foreground">{totalPlanchas}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="text-muted-foreground">Importe</dt>
                <dd className="text-lg font-semibold text-foreground">{formatoMoneda(totalImporte)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Crédito restante</dt>
                <dd
                  className={
                    excedeCredito ? "font-semibold text-destructive" : "font-semibold text-success"
                  }
                >
                  {formatoMoneda(creditoDisponible)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="size-4" aria-hidden />
                  Entrega estimada
                </dt>
                <dd className="font-medium text-foreground">{formatoFecha(entregaEstimada)}</dd>
              </div>
            </dl>

            {(hayBloqueos || excedeCredito) && (
              <p className="flex items-start gap-2 rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {excedeCredito
                  ? `El pedido supera la línea de crédito de ${formatoMoneda(cuenta.lineaCredito)}.`
                  : "Corrige las líneas con advertencias antes de confirmar."}
              </p>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={hayBloqueos || excedeCredito}
              onClick={() => {
                toast.success("Pedido enviado a planta", {
                  description: `${lineas.length} líneas · ${formatoMoneda(totalImporte)}`,
                });
                vaciar();
              }}
            >
              Confirmar pedido
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Se genera orden de compra con lote y fecha de caducidad al despachar.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
