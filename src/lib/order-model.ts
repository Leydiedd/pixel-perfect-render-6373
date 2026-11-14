import { origenPortalPermitido } from "./portal-origin.ts";
import { z } from "zod";

export const nuevoPedidoSchema = z
  .object({
    solicitudId: z
      .string()
      .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i),
    clienteId: z.number().int().positive(),
    lineas: z
      .array(
        z
          .object({
            productoId: z.number().int().positive(),
            cantidad: z
              .number()
              .finite()
              .positive()
              .max(1_000_000)
              .refine(
                (n) => Math.abs(n * 10_000 - Math.round(n * 10_000)) < 0.000001,
                "Máximo cuatro decimales",
              ),
            precioEsperado: z.number().finite().nonnegative(),
            impuestoEsperado: z.number().finite().min(0).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (p) => new Set(p.lineas.map((l) => l.productoId)).size === p.lineas.length,
    "Productos duplicados",
  );
export type NuevoPedido = z.infer<typeof nuevoPedidoSchema>;
export const pedidoCreadoSchema = z.object({
  ok: z.literal(true),
  repetido: z.boolean(),
  pedido: z.object({
    id: z.number().int().positive(),
    ref: z.string().min(1),
    estado: z.number(),
    subtotal: z.number(),
    impuesto: z.number(),
    total: z.number(),
  }),
  factura: z.object({
    id: z.number().int().positive(),
    ref: z.string().min(1),
    estado: z.number(),
    pagada: z.boolean(),
    total: z.number(),
    pdf: z.boolean(),
  }),
  stock: z.object({
    estado: z.enum(["descontado", "sin_productos", "anterior"]),
    almacen: z.object({ id: z.number().int().positive(), nombre: z.string() }).nullable(),
    lineas: z.array(
      z.object({
        productoId: z.number().int().positive(),
        sku: z.string(),
        cantidad: z.number().positive(),
        movimientoId: z.number().int().positive(),
      }),
    ),
    expedicion: z
      .object({ id: z.number().int().positive(), ref: z.string().min(1), estado: z.literal(2) })
      .nullable(),
  }),
  aviso: z.string().nullable(),
});
export type PedidoCreado = z.infer<typeof pedidoCreadoSchema>["pedido"];
export type ResultadoPedido = z.infer<typeof pedidoCreadoSchema>;

export const cancelarPedidoSchema = z
  .object({
    pedidoId: z.number().int().positive(),
    motivo: z.string().trim().min(3).max(500),
  })
  .strict();
export const pedidoCanceladoSchema = z.object({
  ok: z.literal(true),
  repetido: z.boolean(),
  motivo: z.string(),
  pedido: z.object({ id: z.number().int().positive(), ref: z.string(), estado: z.literal(-1) }),
  factura: z.object({ id: z.number().int().positive(), ref: z.string(), estado: z.literal(3) }),
  expedicion: z
    .object({ id: z.number().int().positive(), ref: z.string(), estado: z.literal(-1) })
    .nullable(),
  stock: z.object({
    almacen: z.object({ id: z.number().int().positive(), nombre: z.string() }),
    lineas: z.array(
      z.object({
        productoId: z.number().int().positive(),
        sku: z.string(),
        cantidad: z.number().positive(),
        movimientoId: z.number().int().positive(),
      }),
    ),
  }),
});
export type CancelacionPedido = z.infer<typeof cancelarPedidoSchema>;
export type ResultadoCancelacion = z.infer<typeof pedidoCanceladoSchema>;

export function origenPedidoPermitido(request: Request) {
  const url = new URL(request.url);
  return (
    origenPortalPermitido(url) &&
    request.headers.get("origin") === url.origin &&
    request.headers.get("x-bimbo-request") === "order" &&
    (!request.headers.has("sec-fetch-site") ||
      request.headers.get("sec-fetch-site") === "same-origin") &&
    request.headers.get("content-type")?.split(";")[0]?.trim() === "application/json"
  );
}
