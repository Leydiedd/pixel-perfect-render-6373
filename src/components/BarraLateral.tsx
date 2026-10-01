import { Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, BarChart3, Boxes, ClipboardList, LayoutDashboard, Truck } from "lucide-react";

const accesos = [
  { to: "/", etiqueta: "Panel de control", icono: LayoutDashboard, exacto: true },
  { to: "/pedido", etiqueta: "Pedidos", icono: ClipboardList, exacto: false },
  { to: "/inventario", etiqueta: "Inventario", icono: Boxes, exacto: false },
  { to: "/logistica", etiqueta: "Logística", icono: Truck, exacto: false },
  { to: "/soporte", etiqueta: "Reportes", icono: BarChart3, exacto: false },
  { to: "/alertas", etiqueta: "Alertas", icono: AlertTriangle, exacto: false },
  { to: "/estatus", etiqueta: "Estatus", icono: Activity, exacto: false },
] as const;

export function BarraLateral() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-background/90 backdrop-blur lg:block">
      <nav className="sticky top-28 flex flex-col gap-1 p-3" aria-label="Accesos gerenciales">
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gestión</p>
        {accesos.map(({ to, etiqueta, icono: Icono, exacto }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: exacto }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "!bg-primary/10 !text-primary" }}
          >
            <Icono className="size-4" aria-hidden />
            {etiqueta}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
