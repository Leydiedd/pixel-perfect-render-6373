import { z } from "zod";

export const historialFacturaSchema = z.object({
  factura: z.object({
    id: z.number().int().positive(),
    ref: z.string(),
    cliente: z.string(),
    estado: z.number().int(),
    pagada: z.boolean(),
    total: z.number().finite(),
    cobrado: z.number().finite(),
    creditos: z.number().finite(),
    saldo: z.number().finite().nonnegative(),
    moneda: z.string(),
    pdf: z.boolean(),
  }),
  pagos: z.array(
    z.object({
      id: z.number().int().positive(),
      ref: z.string(),
      fecha: z.string().nullable(),
      importe: z.number().finite(),
      medio: z.string(),
      demostracion: z.boolean(),
      cuenta: z.string().nullable(),
      referencia: z.string().nullable(),
      anulable: z.boolean(),
      bloqueo: z.string().nullable(),
      huella: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
  anulados: z.array(
    z.object({
      id: z.number().int().positive(),
      ref: z.string(),
      importe: z.number(),
      fecha: z.string(),
      motivo: z.string(),
      medio: z.string().nullable(),
      demostracion: z.boolean().nullable(),
      usuario: z.string(),
    }),
  ),
});
export type HistorialFactura = z.infer<typeof historialFacturaSchema>;
