import { z } from "zod";
export const avisoAdminSchema = z.object({
  id: z.number().int().positive(),
  documentoId: z.number().int().positive(),
  referencia: z.string(),
  cliente: z.string(),
  canal: z.enum(["b2b", "b2c"]),
  tipo: z.enum(["pedido_cliente", "pago_cliente"]),
  importe: z.number().positive(),
  moneda: z.string().length(3),
  metodo: z.enum(["tarjeta", "yape", "plin"]).nullable(),
  creadaEn: z.string(),
  leida: z.boolean(),
});
export const avisosAdminSchema = z.object({
  ok: z.literal(true),
  notificaciones: z.array(avisoAdminSchema),
  sinLeer: z.number().int().nonnegative(),
  ultimoId: z.number().int().nonnegative(),
  antes: z.number().int().positive().nullable(),
});
export type AvisoAdmin = z.infer<typeof avisoAdminSchema>;
export function textoAvisoAdmin(n: AvisoAdmin) {
  const importe = new Intl.NumberFormat("es-PE", { style: "currency", currency: n.moneda }).format(
    n.importe,
  );
  const cliente = `${n.cliente} · ${n.canal.toUpperCase()}`;
  const metodo = n.metodo ? { tarjeta: "Tarjeta", yape: "Yape", plin: "Plin" }[n.metodo] : "";
  return n.tipo === "pedido_cliente"
    ? {
        titulo: "Nuevo pedido",
        mensaje: `${cliente} realizó el pedido ${n.referencia} por ${importe}.`,
      }
    : {
        titulo: "Pago registrado",
        mensaje: `${cliente} registró un pago de ${importe}${metodo ? ` con ${metodo}` : ""} para la factura ${n.referencia}.`,
      };
}
export function documentoNotificado(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
