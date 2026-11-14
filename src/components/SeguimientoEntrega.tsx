import { CalendarDays, PackageCheck, Truck } from "lucide-react";
import { estadoEntregaCliente, type EntregaCliente } from "@/lib/customer-delivery";
import { formatoFecha } from "@/lib/dolibarr-model";
const tonos = {
  exito: "border-emerald-200 bg-emerald-50 text-emerald-950",
  aviso: "border-amber-200 bg-amber-50 text-amber-950",
  retraso: "border-red-200 bg-red-50 text-red-950",
  info: "border-blue-200 bg-blue-50 text-blue-950",
  neutro: "border-slate-200 bg-slate-50 text-slate-700",
};
export function SeguimientoEntrega({ pedido, hoy }: { pedido: EntregaCliente; hoy: string }) {
  const estado = estadoEntregaCliente(pedido, hoy);
  const recibido = [1, 2, 3].includes(pedido.estado) && !!pedido.fechaEntregaReal;
  const Icono = recibido ? PackageCheck : Truck;
  return (
    <section
      aria-label="Seguimiento de entrega"
      className={`mt-4 rounded-xl border p-4 ${tonos[estado.tono]}`}
    >
      <div className="flex items-start gap-3">
        <Icono aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">{estado.titulo}</h3>
          <p className="mt-1 text-xs leading-relaxed">{estado.detalle}</p>
        </div>
      </div>
      {pedido.modalidad === "recojo" ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <strong>Punto de recojo:</strong> {pedido.puntoRecojo || "Consulta con administración"}
          </p>
          {pedido.listoRecojo && <p>Listo desde: {formatoFecha(pedido.listoRecojo)}</p>}
          {recibido && <p>Retirado el: {formatoFecha(pedido.fechaEntregaReal ?? null)}</p>}
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-1.5 text-xs">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Fecha prevista de entrega
            </dt>
            <dd className="mt-1 font-medium">
              {pedido.fechaPrevista ? formatoFecha(pedido.fechaPrevista) : "Por confirmar"}
            </dd>
          </div>
          {recibido && (
            <div>
              <dt className="text-xs">Fecha de entrega confirmada</dt>
              <dd className="mt-1 font-medium">{formatoFecha(pedido.fechaEntregaReal ?? null)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
