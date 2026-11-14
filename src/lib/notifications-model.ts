import { z } from "zod";
export const avisoSchema = z.object({
  id: z.number().int().positive(),
  pedidoId: z.number().int().positive(),
  pedidoRef: z.string(),
  tipo: z.enum(["programada", "reprogramada", "entregada", "listo_recojo", "retirado"]),
  fecha: z.string(),
  anterior: z.string().nullable(),
  creadaEn: z.string(),
  leida: z.boolean(),
});
export const avisosSchema = z.object({
  ok: z.literal(true),
  notificaciones: z.array(avisoSchema),
  sinLeer: z.number().int().nonnegative(),
  ultimoId: z.number().int().nonnegative(),
  antes: z.number().int().positive().nullable(),
});
export const leerAvisosSchema = z.union([
  z
    .object({
      ids: z
        .array(z.number().int().positive())
        .min(1)
        .max(50)
        .refine((ids) => new Set(ids).size === ids.length),
    })
    .strict(),
  z.object({ hasta: z.number().int().positive() }).strict(),
]);
export type Aviso = z.infer<typeof avisoSchema>;
const fecha = (s: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(s + "T12:00:00Z"));
export function textoAviso(n: Aviso) {
  switch (n.tipo) {
    case "listo_recojo":
      return {
        titulo: "Listo para recoger",
        mensaje: `Tu pedido ${n.pedidoRef} está listo para recoger desde el ${fecha(n.fecha)}. Consulta el punto de recojo en tu cuenta.`,
      };
    case "retirado":
      return {
        titulo: "Pedido retirado",
        mensaje: `Se confirmó el retiro de tu pedido ${n.pedidoRef} en tienda el ${fecha(n.fecha)}.`,
      };
    case "programada":
      return {
        titulo: "Entrega programada",
        mensaje: `Tu pedido ${n.pedidoRef} tiene entrega prevista para el ${fecha(n.fecha)}.`,
      };
    case "reprogramada":
      return {
        titulo: "Cambió la fecha de entrega",
        mensaje: `La entrega de tu pedido ${n.pedidoRef} cambió${n.anterior ? ` del ${fecha(n.anterior)}` : ""} al ${fecha(n.fecha)}.`,
      };
    case "entregada":
      return {
        titulo: "Pedido entregado",
        mensaje: `Se confirmó la recepción de tu pedido ${n.pedidoRef} el ${fecha(n.fecha)}.`,
      };
  }
}
