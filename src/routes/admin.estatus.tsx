import { createFileRoute } from "@tanstack/react-router";
import { useDolibarr } from "@/context/dolibarr";
import { Pagina, Metrica, EnDolibarr } from "@/components/DatosReales";
import { Card } from "@/components/ui/card";
export const Route = createFileRoute("/admin/estatus")({ component: Estatus });
function Estatus() {
  const { datos } = useDolibarr();
  return (
    <Pagina
      titulo="Estado de los datos"
      descripcion="Resultado de la última consulta correcta a Dolibarr."
    >
      <Card className="p-5">
        <p className="font-semibold">Datos recibidos</p>
        <p className="text-sm">
          {new Date(datos.fuente.consultadoEn).toLocaleString("es-PE", {
            timeZone: "America/Lima",
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          Actualización automática cada 30 segundos mientras esta aplicación está abierta. También
          puedes pulsar Actualizar.
        </p>
        <EnDolibarr ruta="index.php" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica titulo="Productos" valor={datos.productos.length} />
        <Metrica titulo="Facturas" valor={datos.facturas.length.toLocaleString("es-PE")} />
        <Metrica titulo="Almacenes" valor={datos.almacenes.length} />
      </div>
      <Card className="p-5 text-sm text-muted-foreground">
        No hay telemetría de flota, disponibilidad de planta ni un historial de caídas conectado.
        Esta vista confirma la lectura de datos, no el estado operativo de esos servicios.
      </Card>
    </Pagina>
  );
}
