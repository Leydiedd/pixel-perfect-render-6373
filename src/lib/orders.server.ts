import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  nuevoPedidoSchema,
  pedidoCreadoSchema,
  origenPedidoPermitido,
  cancelarPedidoSchema,
  pedidoCanceladoSchema,
} from "./order-model";

export function ejecutarPedido(
  payload: string,
  cancelar = false,
  pagar = false,
  anularPago = false,
  pagoCliente = false,
  entregar = false,
  programar = false,
  recojo = false,
): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(
      process.env["DOLIBARR_PHP_BINARY"] || "C:/xampp/php/php.exe",
      [
        resolve(
          process.cwd(),
          recojo
            ? "server/dolibarr-pickup.php"
            : programar
              ? "server/dolibarr-delivery-plan.php"
              : entregar
                ? "server/dolibarr-delivery.php"
                : anularPago
                  ? "server/dolibarr-payment-void.php"
                  : pagar
                    ? "server/dolibarr-payment.php"
                    : cancelar
                      ? "server/dolibarr-cancel.php"
                      : "server/dolibarr-order.php",
        ),
        ...(pagoCliente ? ["customer-demo"] : []),
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Timeout"));
    }, 45_000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.length > 1_000_000) {
        child.kill();
        reject(new Error("Response too large"));
      }
    });
    // Consume diagnostics, without logging private data or returning SQL to browsers.
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolveOutput(output) : reject(new Error("Dolibarr failed"));
    });
    child.stdin.end(payload);
  });
}

export async function cancelarPedido(request: Request): Promise<Response> {
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
    parsed = cancelarPedidoSchema.safeParse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Solicitud de cancelación inválida." }, { status: 400, headers });
  }
  if (!parsed.success)
    return Response.json(
      { error: "Indica el pedido y un motivo de 3 a 500 caracteres." },
      { status: 400, headers },
    );
  try {
    const result = JSON.parse(await ejecutarPedido(JSON.stringify(parsed.data), true));
    if (result.ok !== true)
      return Response.json(
        {
          error: typeof result.error === "string" ? result.error : "No se pudo cancelar el pedido.",
        },
        { status: [400, 403, 409, 503].includes(result.status) ? result.status : 503, headers },
      );
    return Response.json(pedidoCanceladoSchema.parse(result), { status: 200, headers });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo confirmar la cancelación. Reintenta el mismo pedido para recuperar el resultado sin duplicar la devolución.",
      },
      { status: 503, headers },
    );
  }
}
export async function crearPedido(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (!origenPedidoPermitido(request))
    return Response.json(
      { error: "Solicitud no autorizada desde este origen." },
      { status: 403, headers },
    );
  let parsed;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 65_536)
      return Response.json({ error: "Pedido demasiado grande." }, { status: 413, headers });
    const raw = await request.text();
    if (raw.length > 65_536)
      return Response.json({ error: "Pedido demasiado grande." }, { status: 413, headers });
    parsed = nuevoPedidoSchema.safeParse(JSON.parse(raw));
  } catch {
    return Response.json(
      { error: "El formato del pedido no es válido." },
      { status: 400, headers },
    );
  }
  if (!parsed.success)
    return Response.json(
      { error: "Revisa el cliente, los productos y las cantidades del pedido." },
      { status: 400, headers },
    );
  try {
    const result = JSON.parse(await ejecutarPedido(JSON.stringify(parsed.data)));
    if (result.ok !== true)
      return Response.json(
        {
          error: typeof result.error === "string" ? result.error : "No se pudo guardar el pedido.",
          revisable: result.revisable === true,
        },
        { status: [400, 403, 409, 503].includes(result.status) ? result.status : 503, headers },
      );
    const response = pedidoCreadoSchema.parse(result);
    return Response.json(response, { status: response.repetido ? 200 : 201, headers });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo confirmar el resultado. Reintenta el mismo envío para recuperar el pedido y su factura sin duplicarlos.",
      },
      { status: 503, headers },
    );
  }
}
