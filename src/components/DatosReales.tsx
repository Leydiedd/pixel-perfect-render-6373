import { lazy, Suspense, useState, type ReactNode } from "react";
const ConsultaDolibarr = lazy(() =>
  import("./ConsultaDolibarr").then((m) => ({ default: m.ConsultaDolibarr })),
);
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDolibarr } from "@/context/dolibarr";
import { formatoMoneda } from "@/lib/dolibarr-model";

export function Pagina({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </div>
  );
}
export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
export function Metrica({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: ReactNode;
  detalle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {titulo}
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{valor}</p>
        {detalle && <p className="mt-2 text-xs text-muted-foreground">{detalle}</p>}
      </CardContent>
    </Card>
  );
}
export function Dinero({ valor, moneda }: { valor: number | null; moneda?: string }) {
  const { datos } = useDolibarr();
  return (
    <>{valor === null ? "Sin precio" : formatoMoneda(valor, moneda ?? datos.empresa.moneda)}</>
  );
}
export function Estado({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-navy-soft px-2.5 py-1 text-xs font-medium">
      {children}
    </span>
  );
}
export function Paginacion({
  actual,
  totalPaginas,
  total,
  cambiar,
}: {
  actual: number;
  totalPaginas: number;
  total: number;
  cambiar: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
      <span>
        {total.toLocaleString("es-PE")} registros · Página {actual} de {totalPaginas}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={actual <= 1}
          onClick={() => cambiar(actual - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={actual >= totalPaginas}
          onClick={() => cambiar(actual + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
export function EnDolibarr({
  ruta,
  children = "Consultar en Dolibarr",
  soloErp = false,
}: {
  ruta: string;
  children?: ReactNode;
  soloErp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center text-left text-sm font-medium text-primary hover:underline"
      >
        {children}
      </button>
      {open && (
        <Suspense
          fallback={
            <span role="status" className="text-xs">
              Abriendo detalle…
            </span>
          }
        >
          <ConsultaDolibarr ruta={ruta} soloErp={soloErp} cerrar={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
