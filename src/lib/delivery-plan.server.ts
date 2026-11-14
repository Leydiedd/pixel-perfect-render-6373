import { sesionActual, leerJson } from "./auth.server";
import { origenPedidoPermitido } from "./order-model";
import { ejecutarPedido } from "./orders.server";
import { fechaPrevistaSchema, fechaProgramadaSchema } from "./delivery-model";
export async function programarEntrega(request: Request) {
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
      parsed = fechaPrevistaSchema.safeParse(await leerJson(request, 8192));
    } catch {
      return Response.json(
        { error: "Solicitud inválida.", revisable: true },
        { status: 400, headers },
      );
    }
    if (!parsed.success)
      return Response.json(
        { error: "Indica una fecha prevista válida.", revisable: true },
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
        true,
      ),
    );
    if (!result.ok)
      return Response.json(
        { error: result.error, revisable: result.revisable === true },
        {
          status: [400, 403, 404, 409, 503].includes(result.status) ? result.status : 503,
          headers,
        },
      );
    return Response.json(fechaProgramadaSchema.parse(result), { headers });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo guardar la fecha prevista. Reintenta el mismo envío para recuperar el resultado.",
      },
      { status: 503, headers },
    );
  }
}
