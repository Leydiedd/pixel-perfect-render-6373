import { z } from "zod";
export const metodoDemoSchema = z.enum(["tarjeta", "yape", "plin"]);
export type MetodoDemo = z.infer<typeof metodoDemoSchema>;
export const pagoClienteSchema = z
  .object({
    solicitudId: z.string().uuid(),
    facturaId: z.number().int().positive(),
    metodo: metodoDemoSchema,
    saldoEsperado: z
      .number()
      .finite()
      .positive()
      .max(100_000_000)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001),
  })
  .strict();
export type PagoCliente = z.infer<typeof pagoClienteSchema>;
export const resultadoPagoClienteSchema = z.object({
  ok: z.literal(true),
  repetido: z.boolean(),
  demostracion: z.literal(true),
  metodo: metodoDemoSchema,
  aviso: z.string().nullable(),
  pago: z.object({
    id: z.number().int().positive(),
    ref: z.string().min(1),
    importe: z.number().positive(),
    fecha: z.string(),
  }),
  factura: z.object({
    id: z.number().int().positive(),
    ref: z.string(),
    estado: z.number(),
    pagada: z.boolean(),
    saldo: z.number().nonnegative(),
  }),
});
export type ResultadoPagoCliente = z.infer<typeof resultadoPagoClienteSchema>;
export const nombresMetodo: Record<MetodoDemo, string> = {
  tarjeta: "Tarjeta",
  yape: "Yape",
  plin: "Plin",
};
