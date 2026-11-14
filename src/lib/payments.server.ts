import { ejecutarPedido } from "./orders.server";
import { origenPedidoPermitido } from "./order-model";
import { nuevoPagoSchema, pagoCreadoSchema } from "./payment-model";
export async function registrarPago(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!origenPedidoPermitido(request))
    return Response.json(
      { error: "Solicitud no autorizada desde este origen." },
      { status: 403, headers },
    );
  let parsed;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8192)
      return Response.json({ error: "Solicitud demasiado grande." }, { status: 413, headers });
    const raw = await request.text();
    if (raw.length > 8192)
      return Response.json({ error: "Solicitud demasiado grande." }, { status: 413, headers });
    parsed = nuevoPagoSchema.safeParse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Solicitud de pago inválida." }, { status: 400, headers });
  }
  if (!parsed.success)
    return Response.json(
      { error: "Revisa importe, saldo, fecha, cuenta y medio de pago." },
      { status: 400, headers },
    );
  try {
    const result = JSON.parse(await ejecutarPedido(JSON.stringify(parsed.data), false, true));
    if (result.ok !== true)
      return Response.json(
        {
          error: result.error ?? "No se pudo registrar el pago.",
          revisable: result.revisable === true,
        },
        { status: [400, 403, 409, 503].includes(result.status) ? result.status : 503, headers },
      );
    const success = pagoCreadoSchema.parse(result);
    return Response.json(success, { status: success.repetido ? 200 : 201, headers });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo confirmar el pago. Reintenta el mismo envío para recuperarlo sin duplicarlo.",
      },
      { status: 503, headers },
    );
  }
}
