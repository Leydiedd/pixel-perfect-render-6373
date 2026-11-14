import { origenPortalPermitido } from "./portal-origin.ts";
import type { PagoPedido } from "./order-experience";
import { z } from "zod";

export const canalSchema = z.enum(["b2c", "b2b"]);
const texto = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !/[<>\u0000-\u001f]/.test(v), "Usa texto sin etiquetas ni saltos de línea");
export const registroSchema = z
  .object({
    canal: canalSchema,
    nombre: texto(3, 120),
    contacto: texto(3, 100),
    documento: z
      .string()
      .trim()
      .regex(/^\d{8}$|^\d{11}$/, "Indica un DNI de 8 dígitos o RUC de 11 dígitos"),
    correo: z.string().trim().toLowerCase().email().max(150),
    telefono: z
      .string()
      .trim()
      .regex(/^[+\d ()-]{7,25}$/),
    direccion: texto(5, 200),
    ciudad: texto(2, 80),
    password: z.string().min(10).max(128),
  })
  .strict()
  .refine((v) => v.canal !== "b2b" || v.documento.length === 11, {
    message: "Los negocios deben indicar su RUC",
    path: ["documento"],
  });
export const loginSchema = z
  .object({ login: z.string().trim().min(1).max(150), password: z.string().min(1).max(128) })
  .strict();
export const entregaSchema = z
  .object({
    tipo: z.enum(["delivery", "recojo"]).optional(),
    contacto: texto(3, 100),
    telefono: z
      .string()
      .trim()
      .regex(/^[+\d ()-]{7,25}$/),
    direccion: z
      .string()
      .trim()
      .max(200)
      .refine((v) => !/[<>\u0000-\u001f]/.test(v)),
    ciudad: z
      .string()
      .trim()
      .max(80)
      .refine((v) => !/[<>\u0000-\u001f]/.test(v)),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.tipo !== "recojo") {
      if (v.direccion.length < 5)
        ctx.addIssue({ code: "custom", path: ["direccion"], message: "Indica la dirección" });
      if (v.ciudad.length < 2)
        ctx.addIssue({ code: "custom", path: ["ciudad"], message: "Indica la ciudad" });
    }
  });
export const compraSchema = z
  .object({
    solicitudId: z.string().uuid(),
    canal: canalSchema.optional(),
    entrega: entregaSchema,
    lineas: z
      .array(
        z
          .object({
            productoId: z.number().int().positive(),
            cantidad: z.number().int().min(1).max(1000000),
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
    (v) => new Set(v.lineas.map((l) => l.productoId)).size === v.lineas.length,
    "Productos repetidos",
  );
export type Compra = z.infer<typeof compraSchema>;
export type Sesion = {
  id: number;
  nombre: string;
  rol: "admin" | "cliente";
  clienteId: number | null;
  canal: "b2b" | "b2c" | null;
  nivelTarifa?: number;
};
export type ProductoTienda = {
  foto?: string | null;
  presentacion?: string | null;
  peso?: string | null;
  tipoEnvase?: "paquete" | "caja" | null;
  unidadesEnvase?: number | null;
  id: number;
  sku: string;
  nombre: string;
  descripcion: string;
  categorias: string[];
  precio: number;
  impuesto: number;
  precioFinal: number;
  precioNormal?: number;
  precioFinalNormal?: number;
  impuestoNormal?: number;
  disponible: number;
  unidad: string | null;
  comprable: boolean;
};
export type Catalogo = {
  productos: ProductoTienda[];
  moneda: string;
  nivelTarifa?: number;
  tarifa?: string;
  tarifaNormal?: string;
  minimoMayorista?: number;
};
const centimos = (amount: number) => Math.round((amount + Number.EPSILON * Math.abs(amount)) * 100);
export function condicionMayorista(
  cart: { id: number; cantidad: number }[],
  catalogo: Catalogo | undefined,
) {
  const aplica = catalogo?.nivelTarifa === 2;
  const minimo = aplica ? (catalogo?.minimoMayorista ?? 0) : 0;
  const subtotal = cart.reduce((sum, line) => {
    const p = catalogo?.productos.find((p) => p.id === line.id);
    return sum + (p ? centimos(p.precio * line.cantidad) : 0);
  }, 0);
  const mayorista = aplica && subtotal >= centimos(minimo);
  return {
    aplica,
    minimo,
    mayorista,
    subtotalMayorista: subtotal / 100,
    faltante: aplica ? Math.max(0, centimos(minimo) - subtotal) / 100 : 0,
    tarifa: aplica && !mayorista ? catalogo?.tarifaNormal || "Normal B2C" : catalogo?.tarifa,
  };
}
export function precioParaCompra(
  p: ProductoTienda,
  condicion: ReturnType<typeof condicionMayorista>,
) {
  const normal = condicion.aplica && !condicion.mayorista;
  return {
    precio: normal ? (p.precioNormal ?? p.precio) : p.precio,
    impuesto: normal ? (p.impuestoNormal ?? p.impuesto) : p.impuesto,
    precioFinal: normal ? (p.precioFinalNormal ?? p.precioFinal) : p.precioFinal,
  };
}
export function lineasCarrito(
  cart: { id: number; cantidad: number }[],
  catalogo: Catalogo | undefined,
  pendiente: Compra | null,
) {
  const condicion = condicionMayorista(cart, catalogo);
  const lines = pendiente
    ? pendiente.lineas.map((l) => ({ id: l.productoId, cantidad: l.cantidad }))
    : cart;
  return lines.map((l) => {
    const p = catalogo?.productos.find((p) => p.id === l.id),
      saved = pendiente?.lineas.find((p) => p.productoId === l.id);
    const efectivo = p ? precioParaCompra(p, condicion) : null;
    const precio = saved?.precioEsperado ?? efectivo?.precio ?? 0,
      impuesto = saved?.impuestoEsperado ?? efectivo?.impuesto ?? 0;
    return {
      ...l,
      p,
      precio,
      impuesto,
      precioFinal: Math.round(precio * (1 + impuesto / 100) * 100) / 100,
    };
  });
}
export type Cuenta = {
  puntoRecojo?: string;
  perfil: {
    nombre: string;
    contacto: string;
    documento: string;
    correo: string;
    telefono: string;
    direccion: string;
    ciudad: string;
  };
  pedidos: {
    pago?: PagoPedido;
    modalidad?: "delivery" | "recojo";
    listoRecojo?: string | null;
    puntoRecojo?: string | null;
    fechaPrevista?: string | null;
    fechaEntregaReal?: string | null;
    id: number;
    ref: string;
    fecha: string;
    estado: number;
    total: number;
    canal: string | null;
    entrega: z.infer<typeof entregaSchema> | null;
    facturaId: number | null;
    lineas: { productoId?: number; nombre: string; sku: string; cantidad: number; total: number }[];
  }[];
  facturas: {
    id: number;
    ref: string;
    fecha: string;
    total: number;
    saldo: number;
    pagada: boolean;
    estado: number;
    cobrado: number;
    pdf: boolean;
    pagoDemoPermitido?: boolean;
    pagos?: {
      id: number;
      ref: string;
      fecha: string;
      importe: number;
      metodo: string | null;
      demostracion: boolean;
    }[];
  }[];
  moneda: string;
  pasarelaDemo?: boolean;
};

export function origenLocal(request: Request, escritura = false) {
  const url = new URL(request.url),
    origin = request.headers.get("origin"),
    site = request.headers.get("sec-fetch-site");
  return (
    origenPortalPermitido(url) &&
    (!origin || origin === url.origin) &&
    (!site || ["same-origin", "none"].includes(site)) &&
    (!escritura ||
      (origin === url.origin &&
        request.headers.get("content-type")?.split(";")[0] === "application/json" &&
        request.headers.get("x-bimbo-request") === "store"))
  );
}
