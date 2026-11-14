import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import { usePedido } from "@/context/pedido";
import { Pagina, Vacio, Dinero } from "@/components/DatosReales";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatoCantidad } from "@/lib/dolibarr-model";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/pedido-rapido")({ component: PedidoRapido });
function PedidoRapido() {
  const { datos } = useDolibarr();
  const { agregar, bloqueado } = usePedido();
  const [sku, setSku] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const producto = datos.productos.find((p) => p.sku.toLowerCase() === sku.trim().toLowerCase());
  const valido =
    producto &&
    producto.enVenta &&
    producto.precio !== null &&
    Number.isFinite(cantidad) &&
    cantidad > 0 &&
    cantidad <= producto.stock;
  return (
    <Pagina
      titulo="Pedido rápido"
      descripcion="Selecciona productos y confirma el envío a Dolibarr desde Pedidos."
    >
      <Card className="max-w-xl p-6">
        <label className="space-y-2 text-sm">
          Referencia del producto
          <Input
            list="referencias"
            placeholder="Ej. BB-PAN-001"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </label>
        <datalist id="referencias">
          {datos.productos.map((p) => (
            <option key={p.id} value={p.sku}>
              {p.nombre}
            </option>
          ))}
        </datalist>
        <label className="space-y-2 text-sm">
          Cantidad
          <Input
            type="number"
            step="any"
            min="0.0001"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
        </label>
        {producto ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{producto.nombre}</p>
            <p>
              Stock: {formatoCantidad(producto.stock)} · {producto.unidad || "Unidad no definida"}
            </p>
            <p>
              Precio sin impuestos: <Dinero valor={producto.precio} />
            </p>
          </div>
        ) : (
          sku && <Vacio>No se encontró esa referencia.</Vacio>
        )}
        <Button
          disabled={bloqueado || !valido}
          onClick={() => {
            if (producto) {
              agregar(producto.sku, cantidad);
              toast.success("Producto añadido. Confírmalo en Pedidos.");
            }
          }}
        >
          Añadir al pedido
        </Button>
        <Link to="/admin/pedido" className="text-sm text-primary">
          Revisar y enviar pedido →
        </Link>
      </Card>
    </Pagina>
  );
}
