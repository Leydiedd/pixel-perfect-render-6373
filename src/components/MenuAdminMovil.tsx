import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Button } from "./ui/button";
const links = [
  ["/admin", "Panel de control"],
  ["/admin/pedido", "Pedidos"],
  ["/admin/boletas", "Facturas y pagos"],
  ["/admin/inventario", "Inventario"],
  ["/admin/logistica", "Logística"],
  ["/admin/soporte", "Reportes"],
  ["/admin/calidad-datos", "Calidad de datos"],
  ["/admin/alertas", "Alertas"],
  ["/admin/chatbot", "Consumo del chatbot"],
  ["/admin/estatus", "Estado del sistema"],
] as const;
export function MenuAdminMovil() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir menú de administración"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(330px,90vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Administración</SheetTitle>
          <SheetDescription>Gestiona tu negocio desde aquí.</SheetDescription>
        </SheetHeader>
        <nav aria-label="Menú móvil" className="mt-6 grid gap-1">
          {links.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/admin" }}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center justify-between rounded-lg px-3 text-sm"
              activeProps={{ className: "bg-primary/10 font-semibold text-primary" }}
            >
              {label}
              <ChevronRight className="size-4" />
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
