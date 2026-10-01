import { Link } from "@tanstack/react-router";
import { Bell, CreditCard } from "lucide-react";
import { formatoMoneda } from "@/data/catalogo";
import { usePedido } from "@/context/pedido";
import logo from "@/assets/logo-bimbo.jpg.asset.json";

const pestanas = [
  { to: "/", etiqueta: "Panel de Control", exacto: true },
  { to: "/pedido", etiqueta: "Pedidos", exacto: false },
  { to: "/inventario", etiqueta: "Inventario", exacto: false },
  { to: "/logistica", etiqueta: "Logística", exacto: false },
  { to: "/soporte", etiqueta: "Reportes y Mi Cuenta", exacto: false },
] as const;

export function EncabezadoApp() {
  const { totalPlanchas, creditoDisponible } = usePedido();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2">
        <Link to="/" className="flex items-center gap-3" aria-label="Bimbo Osito — Panel de Control">
          <img src={logo.url} alt="Bimbo" className="h-12 w-14 shrink-0 bg-background object-contain sm:h-14 sm:w-16" />
          <span className="text-xl font-extrabold tracking-tight text-primary sm:text-2xl">Bimbo Osito</span>
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-navy-foreground sm:flex">
            <CreditCard className="size-3.5" aria-hidden />
            Crédito disponible
            <strong>{formatoMoneda(Math.max(creditoDisponible, 0))}</strong>
          </span>
          <Link to="/alertas" aria-label="Alertas" className="relative rounded-md border border-border p-2 hover:bg-accent">
            <Bell className="size-4" />
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">3</span>
          </Link>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border bg-navy px-4" aria-label="Secciones">
        {pestanas.map(({ to, etiqueta, exacto }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: exacto }}
            className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-navy-foreground/75 transition-colors hover:text-navy-foreground"
            activeProps={{ className: "!border-primary !text-navy-foreground" }}
          >
            {etiqueta}
            {to === "/pedido" && totalPlanchas > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{totalPlanchas}</span>
            ) : null}
          </Link>
        ))}
      </nav>
    </header>
  );
}
