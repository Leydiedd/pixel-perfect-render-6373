import { z } from "zod";
const dinero = z
  .number()
  .finite()
  .positive()
  .max(100_000_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, "Máximo dos decimales");
export const nuevoPagoSchema = z
  .object({
    solicitudId: z.string().uuid(),
    facturaId: z.number().int().positive(),
    cuentaId: z.number().int().positive(),
    medioId: z.number().int().positive(),
    importe: dinero,
    saldoEsperado: dinero,
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    referencia: z
      .string()
      .trim()
      .max(60)
      .refine((v) => !/[<>\x00-\x1f]/.test(v)),
  })
  .strict()
  .refine((v) => v.importe <= v.saldoEsperado, "El importe supera el saldo");
export const pagoCreadoSchema = z.object({
  ok: z.literal(true),
  repetido: z.boolean(),
  aviso: z.string().nullable(),
  pago: z.object({
    id: z.number().int().positive(),
    ref: z.string().min(1),
    importe: dinero,
    fecha: z.string(),
    movimientoId: z.number().int().positive(),
    cuenta: z.string(),
  }),
  factura: z.object({
    id: z.number().int().positive(),
    ref: z.string(),
    estado: z.number(),
    pagada: z.boolean(),
    saldo: z.number().nonnegative(),
  }),
});
export type NuevoPago = z.infer<typeof nuevoPagoSchema>;
export type ResultadoPago = z.infer<typeof pagoCreadoSchema>;
