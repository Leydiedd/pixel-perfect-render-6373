import { createFileRoute, Link } from "@tanstack/react-router";
import { useDolibarr } from "@/context/dolibarr";
import { Pagina, Vacio } from "@/components/DatosReales";
import { Card } from "@/components/ui/card";
import { alertasReales } from "@/lib/dolibarr-model";
export const Route = createFileRoute("/admin/alertas")({ component: Alertas });
function Alertas() {
  const { datos } = useDolibarr();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(datos.fuente.consultadoEn),
  );
  const alertas = alertasReales(datos.productos, hoy);
  const umbrales = datos.productos.filter((p) => p.umbral !== null && p.umbral > 0).length;
  return (
    <Pagina
      titulo="Alertas"
      descripcion="Stock negativo, umbrales de stock configurados y lotes vencidos con existencias."
    >
      {alertas.length ? (
        alertas.map((a) => (
          <Card key={a.id} className="p-5">
            <Link
              to="/admin/producto/$sku"
              params={{ sku: a.sku }}
              className="font-semibold text-primary"
            >
              {a.titulo}
            </Link>
            <p className="text-sm">{a.detalle}</p>
          </Card>
        ))
      ) : (
        <Vacio>No se detectaron alertas con los datos disponibles.</Vacio>
      )}
      <Card className="p-5 text-sm">
        <p>
          {umbrales} de {datos.productos.length} productos tienen un umbral de stock mayor que cero.
        </p>
        <p>
          {datos.productos.reduce((n, p) => n + p.lotes.length, 0)} lotes con registro de stock.
        </p>
        <p className="text-muted-foreground">
          Sin umbrales ni fechas de caducidad registrados no se pueden calcular avisos de reposición
          o vencimiento.
        </p>
      </Card>
    </Pagina>
  );
}
