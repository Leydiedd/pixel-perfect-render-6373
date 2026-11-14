import { z } from "zod";
import type { Catalogo, Cuenta, Sesion } from "./store-model";
import type { DatosDolibarr } from "./dolibarr-model";
import { construirDetalles, fechaValida, resumenGerencial } from "./report-details.ts";

export type FuenteChat = { titulo: string; url: string };
export type ContextoChat = {
  sesion: Sesion;
  canal: "b2c" | "b2b";
  carrito: { id: number; cantidad: number }[];
  hoy: string;
  catalogo: () => Promise<Catalogo>;
  cuenta: () => Promise<Cuenta>;
  administracion: () => Promise<DatosDolibarr>;
};
export function canalAutorizado(sesion: Sesion, solicitado: "b2b" | "b2c") {
  return sesion.rol === "cliente" && sesion.canal !== "b2b" ? "b2c" : solicitado;
}
const consulta = z.string().trim().max(100);
const schemas = {
  buscar_productos: z.object({ consulta }).strict(),
  consultar_documentos: z
    .object({
      tipo: z.enum(["pedidos", "facturas"]),
      consulta,
      estado: z.enum(["todos", "pendientes", "parciales", "pagadas", "anuladas"]).default("todos"),
    })
    .strict(),
  buscar_clientes: z.object({ consulta: consulta.min(1) }).strict(),
  consultar_reporte: z
    .object({
      reporte: z.enum([
        "Resumen",
        "Productos",
        "Clientes",
        "Ventas",
        "Cobranza",
        "Pagos",
        "Entregas",
        "Inventario",
        "Compras",
        "Producción",
      ]),
      desde: z.string().refine((v) => v === "" || fechaValida(v)),
      hasta: z.string().refine((v) => v === "" || fechaValida(v)),
      canal: z.enum(["todos", "b2b", "b2c", "sin_clasificar"]),
      consulta,
      pagina: z.number().int().min(1).max(1000),
    })
    .strict()
    .refine((v) => !v.desde || !v.hasta || v.desde <= v.hasta),
};
const str = { type: "string" };
function tool(name: string, description: string, properties: Record<string, unknown>) {
  return {
    type: "function",
    name,
    description,
    strict: true,
    parameters: {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  };
}
export function herramientasChat(admin: boolean) {
  return [
    tool(
      "buscar_productos",
      "Consulta productos por nombre, categoría o SKU. Consulta vacía lista los primeros 10. Precios y stock actual del catálogo, según sesión, canal y carrito. Incluye mínimo mayorista. Admin además ve existencias globales y por almacén.",
      { consulta: str },
    ),
    tool(
      "consultar_documentos",
      "Busca pedidos o facturas por referencia exacta, ID o texto. Consulta vacía muestra 10 recientes. Estado filtra facturas antes de limitar filas: pendientes incluye parciales. Para pedidos usa estado=todos. Cliente: exclusivamente documentos de su propia cuenta. Admin: también permite código de cliente. No supone que pedido cerrado significa entregado.",
      {
        tipo: { type: "string", enum: ["pedidos", "facturas"] },
        consulta: str,
        estado: {
          type: "string",
          enum: ["todos", "pendientes", "parciales", "pagadas", "anuladas"],
        },
      },
    ),
    ...(admin
      ? [
          tool(
            "buscar_clientes",
            "Busca por código exacto, ID o nombre. Devuelve clientes coincidentes y sus 5 facturas más recientes con saldo actual. Prioriza coincidencia exacta de código. No consulta documentos de homónimos por nombre.",
            { consulta: str },
          ),
          tool(
            "consultar_reporte",
            "Obtiene datos calculados por los mismos reportes del panel. Fechas YYYY-MM-DD; vacías significan todo el historial. Consulta filtra filas; página empieza en 1, 10 filas por página. Nunca extrapoles totales desde una página. Inventario es actual sin fecha/canal; compras/producción sin canal. Productos y clientes ordenados por ventas descendentes.",
            {
              reporte: {
                type: "string",
                enum: [
                  "Resumen",
                  "Productos",
                  "Clientes",
                  "Ventas",
                  "Cobranza",
                  "Pagos",
                  "Entregas",
                  "Inventario",
                  "Compras",
                  "Producción",
                ],
              },
              desde: str,
              hasta: str,
              canal: { type: "string", enum: ["todos", "b2b", "b2c", "sin_clasificar"] },
              consulta: str,
              pagina: { type: "integer" },
            },
          ),
        ]
      : []),
  ];
}
const normal = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const contiene = (v: unknown, q: string) =>
  normal(q)
    .split(/\s+/)
    .every((t) => normal(v).includes(t));
const cent = (v: number) => Math.round((v + Number.EPSILON * Math.abs(v)) * 100);
const sum = (v: number[]) => v.reduce((n, x) => n + cent(x), 0) / 100;
const estadoPedido = (n: number) =>
  ({
    "-1": "Cancelado",
    0: "Borrador",
    1: "Validado",
    2: "En proceso",
    3: "Cerrado (no confirma recepción)",
  })[n] ?? "Sin clasificar";
const estadoFactura = (f: { estado: number; pagada: boolean; cobrado: number; saldo: number }) =>
  f.estado === 3
    ? "Anulada"
    : f.estado === 0
      ? "Borrador"
      : f.pagada
        ? "Pagada"
        : f.saldo > 0
          ? f.cobrado > 0
            ? "Parcialmente pagada"
            : "Pendiente de pago"
          : "Cerrada / por conciliar";
function coincidencias<T extends { id: number; ref: string }>(
  items: T[],
  q: string,
  text: (x: T) => string,
) {
  const exact = items.filter((x) => normal(x.ref) === normal(q) || String(x.id) === q);
  return exact.length ? exact : items.filter((x) => contiene(text(x), q));
}
export async function ejecutarHerramienta(
  name: string,
  raw: unknown,
  ctx: ContextoChat,
): Promise<{ datos: unknown; fuentes: FuenteChat[] }> {
  // Authorization is enforced here too, never delegated to the prompt/model.
  const admin = ctx.sesion.rol === "admin";
  if (!herramientasChat(admin).some((t) => t.name === name))
    throw new Error("Consulta no permitida para esta sesión.");
  const meta = { fuente: "Dolibarr", consultadoEn: new Date().toISOString() };
  if (name === "buscar_productos") {
    const { consulta: q } = schemas.buscar_productos.parse(raw);
    const cat = await ctx.catalogo();
    const mayorista = cat.nivelTarifa === 2;
    const subtotal = sum(
      ctx.carrito.map((l) => (cat.productos.find((p) => p.id === l.id)?.precio ?? 0) * l.cantidad),
    );
    const minimo = mayorista ? (cat.minimoMayorista ?? 0) : 0;
    const aplica = mayorista && cent(subtotal) >= cent(minimo);
    const found = cat.productos.filter((p) =>
      contiene(`${p.sku} ${p.nombre} ${p.categorias.join(" ")}`, q),
    );
    const d = admin ? await ctx.administracion() : null;
    const stock = d?.productos
      .filter((p) => contiene(`${p.sku} ${p.nombre}`, q))
      .slice(0, 10)
      .map((p) => ({
        sku: p.sku,
        producto: p.nombre,
        stockGlobal: p.stock,
        almacenes: p.almacenes,
        unidad: p.unidad,
      }));
    return {
      datos: {
        ...meta,
        moneda: cat.moneda,
        canal: ctx.canal,
        tarifa: aplica ? cat.tarifa : (cat.tarifaNormal ?? cat.tarifa),
        condicionMayorista: {
          habilitada: mayorista,
          minimoSinIGV: minimo,
          subtotalMayoristaCarritoSinIGV: subtotal,
          aplica,
          faltanteSinIGV: mayorista ? Math.max(0, cent(minimo) - cent(subtotal)) / 100 : 0,
        },
        totalCoincidencias: found.length,
        limite: 10,
        productos: found
          .slice(0, 10)
          .map((p) => ({
            sku: p.sku,
            nombre: p.nombre,
            presentacion: p.presentacion,
            peso: p.peso,
            unidadesEnvase: p.unidadesEnvase,
            precioSinIGV: mayorista && !aplica ? (p.precioNormal ?? p.precio) : p.precio,
            precioConIGV:
              mayorista && !aplica ? (p.precioFinalNormal ?? p.precioFinal) : p.precioFinal,
            precioMayoristaSinIGV: mayorista ? p.precio : null,
            disponibleTienda: p.disponible,
            comprable: p.comprable,
            unidad: p.unidad,
          })),
        ...(stock ? { inventarioAdministracion: stock } : {}),
        aviso:
          "Disponibilidad para comprar en la tienda; puede diferir del stock global. Los precios se revalidan al comprar. El carrito recibido sirve para cotizar, no reserva stock.",
      },
      fuentes: [
        { titulo: admin ? "Inventario" : "Ver catálogo", url: admin ? "/admin/inventario" : "/" },
      ],
    };
  }
  if (name === "consultar_documentos") {
    const { tipo, consulta: q, estado } = schemas.consultar_documentos.parse(raw);
    const d = admin ? await ctx.administracion() : null;
    const cuenta = admin ? null : await ctx.cuenta();
    const clientes =
      d?.clientes.filter((c) => normal(c.codigo) === normal(q) || String(c.id) === q) ?? [];
    const ids = new Set(clientes.map((c) => c.id));
    if (tipo === "facturas") {
      const all: (DatosDolibarr["facturas"][number] | Cuenta["facturas"][number])[] =
        d?.facturas ?? cuenta!.facturas;
      const candidates =
        ids.size && d
          ? d.facturas.filter((f) => ids.has(f.clienteId ?? 0))
          : coincidencias(all, q, (f) => `${f.ref} ${"cliente" in f ? f.cliente : ""}`);
      const found = candidates.filter(
        (f) =>
          estado === "todos" ||
          (estado === "anuladas" && f.estado === 3) ||
          (estado === "pagadas" && f.pagada && f.estado !== 3) ||
          (estado === "pendientes" && f.estado === 1 && !f.pagada && f.saldo > 0) ||
          (estado === "parciales" && f.estado === 1 && !f.pagada && f.saldo > 0 && f.cobrado > 0),
      );
      const selected = [...found]
        .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? "") || b.id - a.id)
        .slice(0, 10);
      return {
        datos: {
          ...meta,
          moneda: d?.empresa.moneda ?? cuenta!.moneda,
          filtroEstado: estado,
          totalCoincidencias: found.length,
          limite: 10,
          facturas: selected.map((f) => ({
            ref: f.ref,
            cliente: "cliente" in f ? f.cliente : cuenta?.perfil.nombre,
            fecha: f.fecha,
            totalConIGV: f.total,
            cobrado: f.cobrado,
            saldoActual: f.saldo,
            estado: estadoFactura(f),
            pdfDisponible: f.pdf,
          })),
        },
        fuentes: selected
          .slice(0, 5)
          .flatMap((f) => [
            { titulo: f.ref, url: admin ? `/admin/boletas?factura=${f.id}` : "/mi-cuenta" },
            ...(f.pdf
              ? [
                  {
                    titulo: `PDF ${f.ref}`,
                    url: `${admin ? "/api/dolibarr" : "/api/cuenta"}?documento=${f.id}`,
                  },
                ]
              : []),
          ]),
      };
    }
    if (estado !== "todos")
      throw new Error(
        "El filtro de pago se aplica a facturas; consulta facturas para ver pendientes.",
      );
    const all: (DatosDolibarr["pedidos"][number] | Cuenta["pedidos"][number])[] =
      d?.pedidos ?? cuenta!.pedidos;
    const found =
      ids.size && d
        ? d.pedidos.filter((p) => ids.has(p.clienteId ?? 0))
        : coincidencias(all, q, (p) => `${p.ref} ${"cliente" in p ? p.cliente : ""}`);
    const selected = [...found]
      .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? "") || b.id - a.id)
      .slice(0, 10);
    return {
      datos: {
        ...meta,
        moneda: d?.empresa.moneda ?? cuenta!.moneda,
        totalCoincidencias: found.length,
        limite: 10,
        pedidos: selected.map((p) => ({
          ref: p.ref,
          fecha: p.fecha,
          totalConIGV: p.total,
          estado: estadoPedido(p.estado),
          modalidad: p.modalidad,
          fechaPrevista: "lineas" in p ? p.fechaPrevista : p.entrega,
          fechaRecibido: p.fechaEntregaReal,
          listoParaRecoger: p.listoRecojo,
          ...("lineas" in p
            ? { pago: p.pago, productos: p.lineas.slice(0, 20), totalLineas: p.lineas.length }
            : { bloqueoPorPago: "bloqueoPago" in p ? p.bloqueoPago : null }),
        })),
      },
      fuentes: selected
        .slice(0, 6)
        .map((p) => ({
          titulo: p.ref,
          url: admin ? `/admin/pedido?pedido=${p.id}` : "/mi-cuenta",
        })),
    };
  }
  if (name === "buscar_clientes") {
    const { consulta: q } = schemas.buscar_clientes.parse(raw);
    const d = await ctx.administracion();
    const exact = d.clientes.filter((c) => normal(c.codigo) === normal(q) || String(c.id) === q);
    const rows = exact.length
      ? exact
      : d.clientes.filter((c) => contiene(`${c.codigo} ${c.nombre}`, q));
    const fuentes: FuenteChat[] = [];
    return {
      datos: {
        ...meta,
        moneda: d.empresa.moneda,
        totalCoincidencias: rows.length,
        limite: 5,
        clientes: rows.slice(0, 5).map((c) => {
          const invoices = d.facturas.filter((f) => f.clienteId === c.id);
          const recent = invoices.slice(0, 5);
          for (const f of recent)
            fuentes.push({
              titulo: `${c.codigo} · ${f.ref}`,
              url: `/admin/boletas?factura=${f.id}`,
            });
          return {
            codigo: c.codigo,
            nombre: c.nombre,
            totalFacturas: invoices.length,
            saldoActual: sum(
              invoices
                .filter((f) => f.estado === 1 && !f.pagada && f.tipo !== 2)
                .map((f) => f.saldo),
            ),
            facturasRecientes: recent.map((f) => ({
              ref: f.ref,
              fecha: f.fecha,
              totalConIGV: f.total,
              saldoActual: f.saldo,
              estado: estadoFactura(f),
            })),
          };
        }),
      },
      fuentes: fuentes.slice(0, 8),
    };
  }
  const args = schemas.consultar_reporte.parse(raw);
  const d = await ctx.administracion();
  const filtros = { desde: args.desde, hasta: args.hasta, canal: args.canal };
  const r = construirDetalles(d, filtros, ctx.hoy)[args.reporte]!;
  const rows = r.filas.filter((row) => contiene(Object.values(row).join(" "), args.consulta));
  const resumen = resumenGerencial(d, filtros);
  return {
    datos: {
      ...meta,
      moneda: d.empresa.moneda,
      filtros,
      titulo: r.titulo,
      criterios: r.nota,
      ...(args.reporte === "Resumen"
        ? { facturas: resumen.facturas.length, facturasPendientes: resumen.pendiente.length }
        : {}),
      columnas: r.columnas,
      totalFilas: rows.length,
      pagina: args.pagina,
      totalPaginas: Math.ceil(rows.length / 10),
      filas: rows.slice((args.pagina - 1) * 10, args.pagina * 10),
    },
    fuentes: [{ titulo: `Reporte: ${args.reporte}`, url: "/admin/soporte" }],
  };
}
