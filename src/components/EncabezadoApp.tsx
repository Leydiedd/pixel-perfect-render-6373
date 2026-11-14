import { MenuAdminMovil } from "./MenuAdminMovil";
import { NotificacionesAdmin } from "./NotificacionesAdmin";
import { Link } from "@tanstack/react-router";
import { TriangleAlert, RefreshCw } from "lucide-react";
import { useDolibarr } from "@/context/dolibarr";
import { usePedido } from "@/context/pedido";
import { alertasReales } from "@/lib/dolibarr-model";
import { Button } from "@/components/ui/button";
const links = [
  { to: "/admin", label: "Panel de control" },
  { to: "/admin/inventario", label: "Inventario" },
  { to: "/admin/pedido", label: "Pedidos" },
  { to: "/admin/boletas", label: "Facturas" },
  { to: "/admin/logistica", label: "Logística" },
  { to: "/admin/soporte", label: "Reportes" },
  { to: "/admin/chatbot", label: "Chatbot" },
  { to: "/admin/calidad-datos", label: "Calidad de datos" },
] as const;
export function EncabezadoApp({ usuarioId }: { usuarioId: number }) {
  const { datos, actualizarConMensaje, actualizando } = useDolibarr();
  const { lineas } = usePedido();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(datos.fuente.consultadoEn),
  );
  const alerts = alertasReales(datos.productos, hoy).length;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <MenuAdminMovil />
        <Link to="/admin" className="text-xl font-extrabold text-primary">
          Bimbo Osito
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden text-muted-foreground sm:block">
            Datos de Dolibarr ·{" "}
            {new Date(datos.fuente.consultadoEn).toLocaleTimeString("es-PE", {
              timeZone: "America/Lima",
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={actualizarConMensaje}
            disabled={actualizando}
          >
            <RefreshCw className={`size-4 ${actualizando ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <NotificacionesAdmin key={usuarioId} usuarioId={usuarioId} />
          <Link
            to="/admin/alertas"
            className="flex items-center gap-1"
            aria-label={`${alerts} alertas de inventario`}
          >
            <TriangleAlert className="size-4" />
            {alerts}
          </Link>
        </div>
      </div>
      <nav className="hidden gap-1 overflow-x-auto bg-navy px-3 lg:flex" aria-label="Secciones">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.to === "/admin" }}
            className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm text-navy-foreground/80"
            activeProps={{ className: "!border-primary !text-navy-foreground" }}
          >
            {l.label}
            {l.to === "/admin/pedido" && lineas.length > 0 ? ` (${lineas.length})` : ""}
          </Link>
        ))}
      </nav>
    </header>
  );
}
