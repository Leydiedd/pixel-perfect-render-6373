import { sesionActual, leerJson } from "./auth.server";
import { origenPedidoPermitido } from "./order-model";
import { ejecutarPedido } from "./orders.server";
import { recojoSchema } from "./pickup-model";
export async function registrarRecojo(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!origenPedidoPermitido(request))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  try {
    const session = await sesionActual(request);
    if (!session) return Response.json({ error: "Inicia sesión." }, { status: 401, headers });
    if (session.rol !== "admin")
      return Response.json(
        { error: "Acceso reservado a administración." },
        { status: 403, headers },
      );
    let parsed;
    try {
      parsed = recojoSchema.safeParse(await leerJson(request, 8192));
    } catch {
      return Response.json(
        { error: "Solicitud inválida.", revisable: true },
        { status: 400, headers },
      );
    }
    if (!parsed.success)
      return Response.json(
        { error: "Revisa los datos del recojo.", revisable: true },
        { status: 400, headers },
      );
    const result = JSON.parse(
      await ejecutarPedido(
        JSON.stringify({ ...parsed.data, usuarioId: session.id }),
        false,
        false,
        false,
        false,
        false,
        false,
        true,
      ),
    );
    if (!result.ok)
      return Response.json(
        { error: result.error, revisable: result.revisable === true },
        {
          status: [400, 401, 403, 404, 409, 503].includes(result.status) ? result.status : 503,
          headers,
        },
      );
    return Response.json(
      { ok: true, repetido: !!result.repetido, pedido: result.pedido },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "No se pudo confirmar el cambio. Reintenta el mismo envío." },
      { status: 503, headers },
    );
  }
}
