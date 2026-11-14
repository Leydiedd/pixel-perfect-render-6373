import { z } from "zod";
export const entregaPedidoSchema = z
  .object({
    solicitudId: z.string().uuid(),
    pedidoId: z.number().int().positive(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    receptor: z
      .string()
      .trim()
      .min(2)
      .max(128)
      .refine((v) => !/[<>\x00-\x1f]/.test(v)),
  })
  .strict();
export const entregaConfirmadaSchema = z.object({
  ok: z.literal(true),
  repetido: z.boolean(),
  pedido: z.object({
    id: z.number().int().positive(),
    ref: z.string(),
    fechaEntrega: z.string(),
    receptor: z.string(),
  }),
});
export type EntregaPedido = z.infer<typeof entregaPedidoSchema>;
export function hoyLima() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const fechaPrevistaSchema = z
  .object({
    solicitudId: z.string().uuid(),
    pedidoId: z.number().int().positive(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    anterior: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict();
export const fechaProgramadaSchema = z.object({
  ok: z.literal(true),
  repetido: z.boolean(),
  pedido: z.object({ id: z.number().int().positive(), ref: z.string(), fechaPrevista: z.string() }),
});
export type FechaPrevista = z.infer<typeof fechaPrevistaSchema>;
