import { z } from "zod";
import { entregaPedidoSchema } from "./delivery-model.ts";
export const recojoSchema = z.discriminatedUnion("accion", [
  z
    .object({
      solicitudId: z.string().uuid(),
      pedidoId: z.number().int().positive(),
      accion: z.literal("listo"),
    })
    .strict(),
  entregaPedidoSchema.extend({ accion: z.literal("retiro") }).strict(),
]);
export type Recojo = z.infer<typeof recojoSchema>;
