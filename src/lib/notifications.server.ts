import { portalPhp, sesionActual, leerJson } from "./auth.server";
import { origenLocal } from "./store-model";
import { avisosSchema, leerAvisosSchema } from "./notifications-model";
export async function notificacionesApi(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const write = request.method === "PATCH";
  if (!origenLocal(request, write))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  try {
    const s = await sesionActual(request);
    if (!s) return Response.json({ error: "Inicia sesión." }, { status: 401, headers });
    if (s.rol !== "cliente" || !s.clienteId)
      return Response.json({ error: "Acceso reservado a clientes." }, { status: 403, headers });
    let data: unknown;
    if (write) {
      let parsed;
      try {
        parsed = leerAvisosSchema.safeParse(await leerJson(request, 4096));
      } catch {
        return Response.json({ error: "Solicitud inválida." }, { status: 400, headers });
      }
      if (!parsed.success)
        return Response.json({ error: "Notificaciones inválidas." }, { status: 400, headers });
      data = { ...parsed.data, userId: s.id };
    } else {
      const raw = new URL(request.url).searchParams.get("antes");
      if (raw !== null && (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))))
        return Response.json({ error: "Página inválida." }, { status: 400, headers });
      data = { userId: s.id, before: raw === null ? null : Number(raw) };
    }
    const result = await portalPhp(write ? "notifications-read" : "notifications", data);
    if (!result.ok)
      return Response.json(
        { error: result.error },
        { status: [400, 401, 403, 404].includes(result.status) ? result.status : 503, headers },
      );
    return Response.json(write ? { ok: true } : avisosSchema.parse(result), { headers });
  } catch {
    return Response.json(
      { error: "No se pudieron actualizar tus notificaciones. Intenta nuevamente." },
      { status: 503, headers },
    );
  }
}
