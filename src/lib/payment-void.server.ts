import { ejecutarPedido } from "./orders.server";
import { origenPedidoPermitido } from "./order-model";
import { anularPagoSchema, pagoAnuladoSchema } from "./payment-void-model";
export async function anularPago(request: Request): Promise<Response> {
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
    parsed = anularPagoSchema.safeParse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400, headers });
  }
  if (!parsed.success)
    return Response.json(
      { error: "Actualiza el historial e indica un motivo de 3 a 500 caracteres." },
      { status: 400, headers },
    );
  try {
    const result = JSON.parse(
      await ejecutarPedido(JSON.stringify(parsed.data), false, false, true),
    );
    if (result.ok !== true)
      return Response.json(
        {
          error: result.error ?? "No se pudo anular el pago.",
          revisable: result.revisable === true,
        },
        { status: [400, 403, 409, 503].includes(result.status) ? result.status : 503, headers },
      );
    return Response.json(pagoAnuladoSchema.parse(result), { headers });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo confirmar la anulación. Reintenta el mismo envío para recuperar el resultado.",
      },
      { status: 503, headers },
    );
  }
}
