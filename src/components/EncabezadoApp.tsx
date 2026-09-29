import { Link } from "@tanstack/react-router";
import { CreditCard, FileText, PackageCheck, Truck, Boxes, Keyboard, LifeBuoy, ClipboardList } from "lucide-react";
import { cuenta, formatoMoneda, ordenesActivas } from "@/data/catalogo";
import { usePedido } from "@/context/pedido";

const enlaces = [
  { to: "/", etiqueta: "Catálogo", icono: Boxes, exacto: true },
  { to: "/pedido", etiqueta: "Pedido en curso", icono: ClipboardList, exacto: false },
  { to: "/pedido-rapido", etiqueta: "Pedido rápido", icono: Keyboard, exacto: false },
  { to: "/soporte", etiqueta: "Soporte", icono: LifeBuoy, exacto: false },
] as const;

const iconosEstado = {
  "En preparación": PackageCheck,
  "En tránsito": Truck,
  Entregado: FileText,
} as const;

export function EncabezadoApp() {
  const { totalPlanchas, creditoDisponible } = usePedido();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-wide">{cuenta.cliente}</span>
            <span className="opacity-60">·</span>
            <span className="opacity-80">{cuenta.sucursal}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {ordenesActivas.map((orden) => {
              const Icono = iconosEstado[orden.estado];
              return (
                <span key={orden.folio} className="flex items-center gap-1.5 opacity-90">
                  <Icono className="size-3.5" aria-hidden />
                  <span className="font-medium">{orden.folio}</span>
                  <span className="opacity-70">{orden.estado}</span>
                </span>
              );
            })}
            <span className="flex items-center gap-1.5 rounded-full bg-navy-foreground/10 px-3 py-1">
              <CreditCard className="size-3.5" aria-hidden />
              Crédito disponible
              <strong className="font-semibold">{formatoMoneda(Math.max(creditoDisponible, 0))}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold tracking-tight text-foreground">Bimbo Mayorista</span>
            <span className="block text-xs text-muted-foreground">Portal de abastecimiento B2B</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {enlaces.map(({ to, etiqueta, icono: Icono, exacto }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: exacto }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-navy-soft text-foreground" }}
            >
              <Icono className="size-4" aria-hidden />
              {etiqueta}
              {to === "/pedido" && totalPlanchas > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {totalPlanchas}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
