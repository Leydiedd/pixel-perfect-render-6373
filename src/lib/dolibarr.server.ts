import { origenPortalPermitido } from "./portal-origin.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { datosSchema } from "./dolibarr-model";
import { historialFacturaSchema } from "./invoice-history-model";

const execute = promisify(execFile);
export async function responderDolibarr(request: Request, clienteId?: number): Promise<Response> {
  const url = new URL(request.url);
  // Loopback or the explicitly enabled Wi-Fi origin. Same-origin checks stay enforced.
  const local = origenPortalPermitido(url);
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (
    !local ||
    (origin && origin !== url.origin) ||
    (site && !["same-origin", "none"].includes(site))
  )
    return Response.json({ error: "Acceso local requerido." }, { status: 403 });
  const documento = url.searchParams.get("documento");
  const historial = url.searchParams.get("historial");
  if (
    (clienteId && (!documento || historial)) ||
    (documento !== null && historial !== null) ||
    [documento, historial].some((id) => id !== null && !/^[1-9]\d{0,9}$/.test(id))
  )
    return Response.json({ error: "Documento inválido." }, { status: 400 });
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const { stdout } = await execute(
      process.env["DOLIBARR_PHP_BINARY"] || "C:/xampp/php/php.exe",
      [
        resolve(process.cwd(), "server/dolibarr-read.php"),
        ...(documento
          ? ["document", documento]
          : historial
            ? ["history", historial]
            : ["snapshot"]),
      ],
      {
        env: { ...process.env, DOLIBARR_CUSTOMER_ID: clienteId ? String(clienteId) : "" },
        windowsHide: true,
        timeout: 20_000,
        maxBuffer: 24 * 1024 * 1024,
      },
    );
    const data: unknown = JSON.parse(stdout);
    if (historial) {
      if (data && typeof data === "object" && "error" in data)
        return Response.json({ error: "Factura no encontrada." }, { status: 404, headers });
      return Response.json(historialFacturaSchema.parse(data), { headers });
    }
    if (documento) {
      const pdf = data as { error?: string; filename?: string; base64?: string };
      if (pdf.error || !pdf.base64 || !pdf.filename)
        return Response.json(
          { error: "Este documento no tiene un PDF disponible." },
          { status: 404, headers },
        );
      return new Response(new Uint8Array(Buffer.from(pdf.base64, "base64")), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": `${url.searchParams.get("descarga") === "1" ? "attachment" : "inline"}; filename="${pdf.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        },
      });
    }
    const datos = datosSchema.parse(data);
    const lanUrl = process.env["DOLIBARR_LAN_URL"];
    if (lanUrl && url.hostname === new URL(lanUrl).hostname) datos.fuente.url = lanUrl;
    return Response.json(datos, { headers });
  } catch {
    // Do not return process errors, SQL, connection strings or credentials to the client.
    return Response.json(
      {
        error:
          "No se pudo consultar Dolibarr. Comprueba que MySQL esté encendido y vuelve a intentar.",
      },
      { status: 503, headers },
    );
  }
}
