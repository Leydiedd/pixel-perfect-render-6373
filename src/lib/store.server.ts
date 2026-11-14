import { portalPhp, sesionActual, leerJson } from "./auth.server";
import { origenLocal, compraSchema } from "./store-model";
import { ejecutarPedido } from "./orders.server";
import { pedidoCreadoSchema } from "./order-model";
import { responderDolibarr } from "./dolibarr.server";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function tiendaApi(request: Request, mode: "catalog" | "account" | "purchase") {
  if (!origenLocal(request, mode === "purchase"))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  try {
    if (mode === "catalog") {
      const url = new URL(request.url);
      const s = await sesionActual(request);
      const canal = url.searchParams.get("canal") || "b2c";
      if (!["b2c", "b2b"].includes(canal))
        return Response.json({ error: "Canal inválido." }, { status: 400, headers });
      let customerId = s?.rol === "cliente" ? s.clienteId : null;
      if (url.searchParams.has("clienteId")) {
        if (s?.rol !== "admin")
          return Response.json(
            { error: "Acceso reservado a administración." },
            { status: s ? 403 : 401, headers },
          );
        const raw = url.searchParams.get("clienteId")!;
        if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
          return Response.json({ error: "Cliente inválido." }, { status: 400, headers });
        customerId = Number(raw);
      }
      const result = await portalPhp("catalog", {
        customerId,
        canal: s?.rol === "admin" && url.searchParams.has("clienteId") ? null : canal,
      });
      return Response.json(result, { status: result.ok ? 200 : result.status || 503, headers });
    }
    const s = await sesionActual(request);
    if (!s)
      return Response.json({ error: "Inicia sesión para continuar." }, { status: 401, headers });
    if (s.rol !== "cliente" || !s.clienteId)
      return Response.json(
        {
          error:
            "Usa una cuenta de cliente para comprar. El administrador gestiona pedidos desde su panel.",
        },
        { status: 403, headers },
      );
    if (mode === "account") {
      const url = new URL(request.url);
      if (url.searchParams.has("documento")) {
        if (url.searchParams.has("historial"))
          return Response.json({ error: "Consulta inválida." }, { status: 400, headers });
        return responderDolibarr(request, s.clienteId);
      }
      const result = await portalPhp("account", { userId: s.id });
      return Response.json(result, { status: result.ok ? 200 : result.status || 503, headers });
    }
    let parsed;
    try {
      parsed = compraSchema.safeParse(await leerJson(request, 65536));
    } catch {
      return Response.json(
        { error: "Revisa el pedido y la dirección de entrega.", revisable: true },
        { status: 400, headers },
      );
    }
    if (!parsed.success)
      return Response.json(
        { error: "Revisa el pedido: cantidades enteras y dirección completa.", revisable: true },
        { status: 400, headers },
      );
    const { entrega, canal: requestedChannel, ...order } = parsed.data;
    const canal = requestedChannel ?? s.canal;
    if (s.canal === "b2c" && canal === "b2b")
      return Response.json(
        { error: "La compra mayorista requiere una cuenta de negocio.", revisable: true },
        { status: 403, headers },
      );
    // Identity is server-controlled. Business accounts can choose retail; consumers cannot elevate their tariff.
    const result = JSON.parse(
      await ejecutarPedido(
        JSON.stringify({
          ...order,
          clienteId: s.clienteId,
          tienda: { usuarioId: s.id, canal, entrega },
        }),
      ),
    );
    if (!result.ok)
      return Response.json(
        { error: result.error, revisable: result.revisable === true },
        { status: [400, 403, 409, 503].includes(result.status) ? result.status : 503, headers },
      );
    const confirmed = pedidoCreadoSchema.parse(result);
    return Response.json(
      {
        ok: true,
        pedido: confirmed.pedido,
        factura: confirmed.factura,
        aviso: confirmed.aviso,
        repetido: confirmed.repetido,
      },
      { status: confirmed.repetido ? 200 : 201, headers },
    );
  } catch {
    return Response.json(
      {
        error:
          mode === "purchase"
            ? "No se pudo confirmar el resultado. Reintenta el mismo pedido para comprobarlo sin duplicarlo."
            : "No se pudo consultar Dolibarr. Intenta nuevamente.",
      },
      { status: 503, headers },
    );
  }
}
