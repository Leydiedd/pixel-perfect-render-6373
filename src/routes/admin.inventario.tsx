import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ProductoImagen } from "@/components/ProductoImagen";
import { useDolibarr } from "@/context/dolibarr";
import { usePedido } from "@/context/pedido";
import { Pagina, Vacio, Dinero } from "@/components/DatosReales";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatoCantidad } from "@/lib/dolibarr-model";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/inventario")({
  head: () => ({ meta: [{ title: "Inventario real — Bimbo" }] }),
  component: Inventario,
});
function Inventario() {
  const { datos } = useDolibarr();
  const { agregar, bloqueado } = usePedido();
  const [consulta, setConsulta] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const categorias = [...new Set(datos.productos.flatMap((p) => p.categorias))].sort();
  const resultados = datos.productos.filter(
    (p) =>
      (categoria === "Todas" || p.categorias.includes(categoria)) &&
      `${p.sku} ${p.nombre}`
        .toLocaleLowerCase("es")
        .includes(consulta.toLocaleLowerCase("es").trim()),
  );
  return (
    <Pagina
      titulo="Inventario y catálogo"
      descripcion={`${datos.productos.length} productos consultados en Dolibarr. Precios sin impuestos; existencias por almacén.`}
    >
      <Input
        aria-label="Buscar productos"
        placeholder="Buscar por nombre o referencia"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {["Todas", ...categorias].map((c) => (
          <Button
            key={c}
            size="sm"
            variant={categoria === c ? "default" : "outline"}
            onClick={() => setCategoria(c)}
          >
            {c}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{resultados.length} resultados</p>
      {resultados.length === 0 ? (
        <Vacio>No hay productos que coincidan con la búsqueda.</Vacio>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {resultados.map((p) => (
            <Card key={p.id} className="gap-4 p-5">
              <Link
                to="/admin/producto/$sku"
                params={{ sku: p.sku }}
                aria-label={`Ver ${p.nombre}`}
              >
                <ProductoImagen
                  src={p.enVenta && p.tipo === 0 ? `/api/producto-foto?id=${p.id}` : null}
                  alt={p.nombre}
                  className="h-44 w-full border border-slate-100"
                />
              </Link>
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  <Link
                    to="/admin/producto/$sku"
                    params={{ sku: p.sku }}
                    className="font-semibold hover:text-primary"
                  >
                    {p.nombre}
                  </Link>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.categorias.join(" · ") || "Sin categoría"}
              </p>
              <div className="flex items-end justify-between">
                <p className="text-xl font-bold">
                  <Dinero valor={p.precio} />
                </p>
                <p className="text-right text-sm">
                  Stock: <strong>{formatoCantidad(p.stock)}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {p.unidad || "Unidad no definida"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/admin/producto/$sku" params={{ sku: p.sku }}>
                    Ver detalle
                  </Link>
                </Button>
                <Button
                  className="flex-1"
                  disabled={bloqueado || !p.enVenta || p.precio === null || p.stock < 1}
                  onClick={() => {
                    agregar(p.sku, 1);
                    toast.success("Añadido al pedido. Confírmalo en Pedidos.");
                  }}
                >
                  Añadir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Pagina>
  );
}
