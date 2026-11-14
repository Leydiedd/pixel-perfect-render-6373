import { cumplimientoEntrega } from "./reports-model.ts";
export type EntregaCliente = {
  estado: number;
  modalidad?: "delivery" | "recojo";
  listoRecojo?: string | null;
  puntoRecojo?: string | null;
  fechaPrevista?: string | null;
  fechaEntregaReal?: string | null;
};
export function estadoEntregaCliente(p: EntregaCliente, hoy: string) {
  const cumplimiento = cumplimientoEntrega(
    {
      estado: p.estado,
      entrega: p.fechaPrevista ?? null,
      fechaEntregaReal: p.fechaEntregaReal ?? null,
    },
    hoy,
  );
  const n = cumplimiento.diasRetraso ?? 0;
  const dias = `${n} ${n === 1 ? "día" : "días"}`;
  if (p.estado === -1)
    return {
      titulo: "Pedido cancelado",
      detalle: "Este pedido ya no tiene una entrega pendiente.",
      tono: "neutro" as const,
    };
  if (p.estado === 0)
    return {
      titulo: "Pedido pendiente de confirmación",
      detalle: "Te mostraremos el seguimiento cuando el pedido sea confirmado.",
      tono: "neutro" as const,
    };
  if (p.modalidad === "recojo") {
    if (p.fechaEntregaReal)
      return {
        titulo: "Pedido retirado",
        detalle: "El retiro en tienda está confirmado.",
        tono: "exito" as const,
      };
    if (p.listoRecojo)
      return {
        titulo: "Listo para recoger",
        detalle: "Tu pedido está preparado. Puedes acercarte al punto de recojo.",
        tono: "info" as const,
      };
    return {
      titulo: "Recojo en tienda · En preparación",
      detalle: "Te avisaremos cuando tu pedido esté listo para recoger.",
      tono: "neutro" as const,
    };
  }
  switch (cumplimiento.estado) {
    case "a_tiempo":
      return {
        titulo: "Entregado a tiempo",
        detalle: "La recepción de tu pedido está confirmada.",
        tono: "exito" as const,
      };
    case "con_retraso":
      return {
        titulo: "Entregado con retraso",
        detalle: `Tu pedido se recibió con ${dias} de retraso respecto a la fecha prevista.`,
        tono: "aviso" as const,
      };
    case "sin_fecha":
      return {
        titulo: "Entregado",
        detalle: "La recepción está confirmada. No se había registrado una fecha prevista.",
        tono: "exito" as const,
      };
    case "vencido":
      return {
        titulo: "Con retraso · entrega sin confirmar",
        detalle: `La fecha prevista venció hace ${dias}. Estamos pendientes de confirmar la recepción de tu pedido.`,
        tono: "retraso" as const,
      };
    case "pendiente":
      return {
        titulo: "Entrega programada",
        detalle: "Tu pedido sigue dentro del plazo previsto. La recepción aún no está confirmada.",
        tono: "info" as const,
      };
    case "sin_programar":
      return {
        titulo: "Fecha de entrega por confirmar",
        detalle: "Verás aquí la fecha prevista cuando administración la programe.",
        tono: "neutro" as const,
      };
    default:
      return {
        titulo: "Estado de entrega por confirmar",
        detalle: "Consulta con administración para conocer el estado de tu pedido.",
        tono: "neutro" as const,
      };
  }
}
