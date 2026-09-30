import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, History, Keyboard } from "lucide-react";
import { toast } from "sonner";
import {
  buscarProducto,
  formatoFecha,
  formatoMoneda,
  plantillas,
  precioPorVolumen,
  ultimoPedido,
} from "@/data/catalogo";
import { usePedido, type LineaPedido } from "@/context/pedido";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/pedido-rapido")({
  head: () => ({
    meta: [
      { title: "Pedido rápido y plantillas — Bimbo Mayorista" },
      {
        name: "description",
        content:
          "Carga múltiples SKUs con el teclado, repite el último pedido o aplica plantillas de abastecimiento mensual.",
      },
      { property: "og:title", content: "Pedido rápido y plantillas — Bimbo Mayorista" },
      {
        property: "og:description",
        content: "Captura masiva por SKU, lector de código de barras y plantillas recurrentes.",
      },
    ],
  }),
  component: PedidoRapido,
});

type Resultado = { linea: string; sku?: string; planchas?: number; error?: string };

function analizar(texto: string): Resultado[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      const partes = linea.split(/[,;\t ]+/).filter(Boolean);
      const sku = partes[0]?.toUpperCase();
      const planchas = Number(partes[1]);
      const producto = sku ? buscarProducto(sku) : undefined;
      if (!producto) return { linea, error: `SKU «${sku ?? ""}» no existe en el catálogo.` };
      if (!Number.isFinite(planchas) || planchas <= 0)
        return { linea, error: "Falta la cantidad de planchas." };
      if (planchas < producto.minimoPlanchas)
        return { linea, error: `Mínimo ${producto.minimoPlanchas} planchas para ${producto.sku}.` };
      if (planchas > producto.stockPlanchas)
        return { linea, error: `Solo hay ${producto.stockPlanchas} planchas en planta.` };
      return { linea, sku: producto.sku, planchas };
    });
}

function PedidoRapido() {
  const { agregar, reemplazar } = usePedido();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  const validos = (resultados ?? []).filter((r) => r.sku && r.planchas) as Required<Resultado>[];
  const errores = (resultados ?? []).filter((r) => r.error);

  const aplicarLineas = (lineas: LineaPedido[], mensaje: string) => {
    reemplazar(lineas);
    toast.success(mensaje, { description: `${lineas.length} líneas cargadas en el pedido.` });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Pedido rápido y plantillas
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Keyboard className="size-4 text-primary" aria-hidden />
            Captura por teclado
          </h2>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder={"BIM-PB-680, 40\nBIM-PL-500, 20\nBIM-MN-240, 12"}
            className="mt-4 font-mono text-sm"
            aria-label="Listado de SKU y planchas"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => setResultados(analizar(texto))} disabled={!texto.trim()}>
              Validar líneas
            </Button>
            <Button
              variant="outline"
              disabled={validos.length === 0}
              onClick={() => {
                validos.forEach((r) => agregar(r.sku, r.planchas));
                toast.success(`${validos.length} líneas añadidas al pedido`);
                setTexto("");
                setResultados(null);
              }}
            >
              Añadir al pedido
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setTexto("");
                setResultados(null);
              }}
            >
              Limpiar
            </Button>
          </div>

          {resultados && (
            <div className="mt-6 space-y-2">
              {validos.map((r) => {
                 const producto = buscarProducto(r.sku);
                 if (!producto) return null;
                return (
                  <p
                    key={r.sku}
                    className="flex items-center gap-2 rounded-md bg-success/12 px-3 py-2 text-xs text-foreground"
                  >
                    <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                    <span className="font-mono">{r.sku}</span>
                    <span className="text-muted-foreground">{producto.nombre}</span>
                    <span className="ml-auto font-medium">
                      {r.planchas} planchas ·{" "}
                      {formatoMoneda(precioPorVolumen(producto, r.planchas) * r.planchas)}
                    </span>
                  </p>
                );
              })}
              {errores.map((r) => (
                <p
                  key={r.linea}
                  className="flex items-center gap-2 rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground"
                >
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                  <span className="font-mono">{r.linea}</span>
                  <span className="ml-auto">{r.error}</span>
                </p>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="size-4 text-primary" aria-hidden />
              Repetir último pedido
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Folio {ultimoPedido.folio} · {formatoFecha(ultimoPedido.fecha)} ·{" "}
              {ultimoPedido.lineas.length} líneas
            </p>
            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={() => aplicarLineas([...ultimoPedido.lineas], "Último pedido restaurado")}
            >
              Cargar en el pedido actual
            </Button>
          </Card>

          {plantillas.map((plantilla) => (
            <Card key={plantilla.id} className="p-6">
              <h3 className="text-sm font-semibold text-foreground">{plantilla.nombre}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{plantilla.descripcion}</p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {plantilla.lineas.map((l) => (
                  <li key={l.sku} className="flex justify-between">
                    <span className="font-mono">{l.sku}</span>
                    <span>{l.planchas} planchas</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() => aplicarLineas([...plantilla.lineas], `Plantilla «${plantilla.nombre}» aplicada`)}
              >
                Aplicar plantilla
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
