import { jsonApi, storeHeaders } from "@/context/tienda";
import { datosComentario } from "./report-comment-model";
export type ExplicacionReporte = { texto: string; generadoEn: string };
let queue: Promise<unknown> = Promise.resolve();
export function payloadComentario(titulo: string, contexto: string, nota: string, datos: unknown) {
  return JSON.stringify({
    titulo,
    contexto: `${contexto}\n${nota}`.slice(0, 1800),
    datos: datosComentario(datos),
  });
}
export function solicitarComentario(
  payload: string,
  signal?: AbortSignal,
  vigente: () => boolean = () => true,
): Promise<ExplicacionReporte> {
  const run = async () => {
    if (signal?.aborted || !vigente()) throw new Error("La selección cambió.");
    return jsonApi("/api/reporte-comentario", {
      method: "POST",
      headers: storeHeaders,
      body: payload,
      signal: signal ?? null,
    });
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
