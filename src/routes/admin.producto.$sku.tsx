import { ProductoImagen } from "@/components/ProductoImagen";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import { usePedido } from "@/context/pedido";
import { Pagina, Vacio, Metrica, Dinero, EnDolibarr } from "@/components/DatosReales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoCantidad, formatoFecha } from "@/lib/dolibarr-model";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/producto/$sku")({ component: Producto });
function Producto() {
  const { sku } = Route.useParams();
  const { datos } = useDolibarr();
  const { agregar, bloqueado } = usePedido();
  const [cantidad, setCantidad] = useState(1);
  const p = datos.productos.find((producto) => producto.sku === sku);
  if (!p)
    return (
      <Pagina titulo="Producto no encontrado">
        <Vacio>Esta referencia no existe en el catálogo actual.</Vacio>
        <Link to="/admin/inventario">Volver al inventario</Link>
      </Pagina>
    );
  return (
    <Pagina
      titulo={p.nombre}
      descripcion={`${p.sku} · ${p.categorias.join(" · ") || "Sin categoría"}`}
    >
      <ProductoImagen
        src={p.enVenta && p.tipo === 0 ? `/api/producto-foto?id=${p.id}` : null}
        alt={p.nombre}
        className="h-64 w-full border sm:h-80"
      />
      <EnDolibarr ruta={`product/card.php?id=${p.id}`} />
      <p className="whitespace-pre-line text-sm">
        {p.descripcion || "Sin descripción registrada."}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica titulo="Precio sin impuestos" valor={<Dinero valor={p.precio} />} />
        <Metrica titulo="Precio con impuestos" valor={<Dinero valor={p.precioConImpuesto} />} />
        <Metrica
          titulo="Stock total"
          valor={formatoCantidad(p.stock)}
          detalle={p.unidad || "Unidad de venta no definida en Dolibarr"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existencias por almacén</CardTitle>
        </CardHeader>
        <CardContent>
          {p.almacenes.length ? (
            p.almacenes.map((a) => (
              <div key={a.id} className="flex justify-between border-b py-3 text-sm">
                <span>{a.nombre}</span>
                <strong>
                  {formatoCantidad(a.cantidad)} {p.unidad}
                </strong>
              </div>
            ))
          ) : (
            <Vacio>Sin existencias por almacén registradas.</Vacio>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lotes</CardTitle>
        </CardHeader>
        <CardContent>
          {p.lotes.length ? (
            p.lotes.map((l, i) => (
              <div key={i} className="border-b py-3 text-sm">
                {l.lote} · {l.almacen} · Cantidad {formatoCantidad(l.cantidad)} · Vencimiento{" "}
                {formatoFecha(l.caducidad)}
              </div>
            ))
          ) : (
            <Vacio>Este producto no tiene lotes ni fechas de caducidad registrados.</Vacio>
          )}
        </CardContent>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Añadir a tu pedido</h2>
        <p className="text-sm text-muted-foreground">
          La cantidad usa la unidad de Dolibarr. Confirma el cliente y el envío desde Pedidos para
          registrarlo.
        </p>
        <div className="flex gap-3">
          <Input
            className="w-32"
            aria-label="Cantidad"
            type="number"
            min="0.0001"
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
          <Button
            disabled={
              bloqueado ||
              !p.enVenta ||
              p.precio === null ||
              !Number.isFinite(cantidad) ||
              cantidad <= 0 ||
              cantidad > p.stock
            }
            onClick={() => {
              agregar(p.sku, cantidad);
              toast.success("Añadido al pedido. Confírmalo en Pedidos.");
            }}
          >
            Añadir al pedido
          </Button>
        </div>
        <Link to="/admin/pedido" className="text-sm text-primary">
          Revisar y enviar pedido →
        </Link>
        {cantidad > p.stock && (
          <p className="text-sm text-destructive">La cantidad supera las existencias.</p>
        )}
      </Card>
    </Pagina>
  );
}
