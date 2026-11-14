import { sesionActual, leerJson } from "./auth.server";
import { origenLocal } from "./store-model";
import { ejecutarPedido } from "./orders.server";
import { pagoClienteSchema, resultadoPagoClienteSchema } from "./customer-payment-model";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function pagarFacturaCliente(request: Request) {
  if (!origenLocal(request, true))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  try {
    const session = await sesionActual(request);
    if (!session)
      return Response.json({ error: "Inicia sesión para continuar." }, { status: 401, headers });
    if (session.rol !== "cliente" || !session.clienteId)
      return Response.json(
        { error: "Esta pasarela de pagos requiere una cuenta de cliente." },
        { status: 403, headers },
      );
    let parsed;
    try {
      parsed = pagoClienteSchema.safeParse(await leerJson(request, 8192));
    } catch {
      return Response.json(
        { error: "Solicitud de pago inválida.", revisable: true },
        { status: 400, headers },
      );
    }
    if (!parsed.success)
      return Response.json(
        { error: "Revisa la factura, el método y el saldo.", revisable: true },
        { status: 400, headers },
      );
    // The authenticated user is never accepted from the browser. PHP rechecks ownership under lock.
    const result = JSON.parse(
      await ejecutarPedido(
        JSON.stringify({ ...parsed.data, usuarioId: session.id }),
        false,
        true,
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
    const receipt = resultadoPagoClienteSchema.parse(result);
    return Response.json(receipt, { status: receipt.repetido ? 200 : 201, headers });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo confirmar el pago. Reintenta el mismo envío para recuperar el resultado sin duplicarlo.",
      },
      { status: 503, headers },
    );
  }
}
