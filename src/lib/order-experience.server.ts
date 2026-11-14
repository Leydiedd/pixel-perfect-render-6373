import { portalPhp, sesionActual } from "./auth.server";
import { origenLocal } from "./store-model";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function experienciaApi(
  request: Request,
  mode: "order-detail" | "quality" | "product-photo",
) {
  if (!origenLocal(request))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  try {
    const raw = new URL(request.url).searchParams.get("id");
    if (mode !== "quality" && (!raw || !/^\d{1,9}$/.test(raw) || Number(raw) < 1))
      return Response.json({ error: "Identificador inválido." }, { status: 400, headers });
    const s = mode === "product-photo" ? null : await sesionActual(request);
    if (mode !== "product-photo" && !s)
      return Response.json({ error: "Inicia sesión." }, { status: 401, headers });
    if (mode === "quality" && s?.rol !== "admin")
      return Response.json(
        { error: "Acceso reservado a administración." },
        { status: 403, headers },
      );
    const r = await portalPhp(mode, { id: Number(raw), userId: s?.id });
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status || 503, headers });
    if (mode === "product-photo")
      return new Response(new Uint8Array(Buffer.from(r.base64, "base64")), {
        headers: {
          ...headers,
          "Content-Type": r.mime,
          "Content-Security-Policy": "default-src 'none'",
        },
      });
    return Response.json(r, { headers });
  } catch {
    return Response.json(
      { error: "No se pudo consultar Dolibarr. Reintenta." },
      { status: 503, headers },
    );
  }
}
