import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { sesionActual, leerJson } from "./auth.server";
import { origenLocal } from "./store-model";
import { hoyLima } from "./delivery-model";
import { cargarConfigChat, reservarConsulta } from "./chat-config.server";
import { comenzarMedicion, leerMetricas } from "./chat-metrics.server";
import { ErrorChat, transporteOpenAI } from "./chat-engine";
import { comentarioSchema, generarComentario } from "./report-comment-model";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const cache = new Map<string, { texto: string; generadoEn: string; expires: number }>();
const busy = new Set<number>();
export async function comentarioReporteApi(request: Request) {
  if (!origenLocal(request, true))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  let measurement: Awaited<ReturnType<typeof comenzarMedicion>> | undefined;
  let userId: number | undefined;
  try {
    const s = await sesionActual(request);
    if (!s || s.rol !== "admin")
      return Response.json(
        { error: "Solo administración puede explicar reportes." },
        { status: s ? 403 : 401, headers },
      );
    let input;
    try {
      input = comentarioSchema.parse(await leerJson(request, 65000));
    } catch {
      return Response.json(
        { error: "El reporte excede el tamaño permitido o no es válido." },
        { status: 400, headers },
      );
    }
    const config = await cargarConfigChat();
    if (!config.key)
      throw new ErrorChat(
        "Configura la clave del chatbot en .local/openai.env para generar explicaciones.",
      );
    const key = createHash("sha256")
      .update(JSON.stringify([s.id, config.model, input]))
      .digest("hex");
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
    const found = cache.get(key);
    if (found)
      return Response.json({ texto: found.texto, generadoEn: found.generadoEn }, { headers });
    if (busy.has(s.id))
      throw new ErrorChat(
        "Hay otra explicación en curso. Vuelve a intentarlo cuando termine.",
        429,
      );
    busy.add(s.id);
    userId = s.id;
    await leerMetricas();
    await reservarConsulta(resolve(process.cwd(), ".local"), hoyLima(), config.limit);
    measurement = await comenzarMedicion(s, "b2b", config.model);
    const result = await generarComentario(
      input,
      measurement.envolver(transporteOpenAI(config, AbortSignal.timeout(45000))),
    );
    await measurement.terminar("respondida");
    measurement = undefined;
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { ...result, expires: now + 30 * 60000 });
    return Response.json(result, { headers });
  } catch (e) {
    await measurement?.terminar("error").catch(() => {});
    return Response.json(
      {
        error:
          e instanceof ErrorChat
            ? e.message
            : "No se pudo generar la explicación. Tus reportes siguen disponibles; puedes reintentar.",
      },
      { status: e instanceof ErrorChat ? e.status : 503, headers },
    );
  } finally {
    if (userId !== undefined) busy.delete(userId);
  }
}
