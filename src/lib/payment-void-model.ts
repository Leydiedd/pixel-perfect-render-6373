import { z } from "zod";
export const anularPagoSchema = z
  .object({
    solicitudId: z.string().uuid(),
    facturaId: z.number().int().positive(),
    pagoId: z.number().int().positive(),
    huella: z.string().regex(/^[a-f0-9]{64}$/),
    saldoEsperado: z.number().finite().nonnegative(),
    motivo: z
      .string()
      .trim()
      .min(3)
      .max(500)
      .regex(/^[^<>\x00-\x1f]*$/),
  })
  .strict();
export const pagoAnuladoSchema = z.object({
  ok: z.literal(true),
  repetido: z.boolean(),
  pago: z.object({
    id: z.number().int().positive(),
    ref: z.string(),
    importe: z.number(),
    cuenta: z.string().nullable(),
  }),
  factura: z.object({
    id: z.number().int().positive(),
    ref: z.string(),
    saldo: z.number().nonnegative(),
    pagada: z.boolean(),
    estado: z.number().int(),
  }),
  aviso: z.string().nullable(),
});
export type AnularPago = z.infer<typeof anularPagoSchema>;
