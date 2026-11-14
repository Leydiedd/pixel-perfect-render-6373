import { exigirAdmin, leerJson } from "./auth.server";
import { origenLocal } from "./store-model";
import { leerMetricas, guardarSaldo } from "./chat-metrics.server";
import {
  filtrosMetricasSchema,
  saldoChatSchema,
  resumirMetricas,
  diaLima,
} from "./chat-metrics-model";
import { cargarConfigChat } from "./chat-config.server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function metricasChatApi(request: Request) {
  if (!origenLocal(request, request.method !== "GET"))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  const denied = await exigirAdmin(request);
  if (denied) return denied;
  try {
    if (request.method === "POST") {
      let parsed;
      try {
        parsed = saldoChatSchema.safeParse(await leerJson(request, 2048));
      } catch {
        return Response.json({ error: "Saldo inválido." }, { status: 400, headers });
      }
      if (!parsed.success)
        return Response.json(
          { error: "Indica un saldo en USD, con hasta dos decimales." },
          { status: 400, headers },
        );
      try {
        await guardarSaldo(parsed.data.usd, parsed.data.revision);
      } catch {
        return Response.json(
          {
            error:
              "No se guardó la referencia. Recarga para comprobar si otro administrador cambió el saldo e intenta nuevamente.",
          },
          { status: 409, headers },
        );
      }
      return Response.json({ ok: true }, { headers });
    }
    const params = new URL(request.url).searchParams;
    const filters = filtrosMetricasSchema.safeParse({
      desde: params.get("desde") ?? "",
      hasta: params.get("hasta") ?? "",
      rol: params.get("rol") ?? "todos",
    });
    if (!filters.success)
      return Response.json({ error: "Revisa las fechas del filtro." }, { status: 400, headers });
    const store = await leerMetricas(),
      config = await cargarConfigChat();
    let utilizadas: number | null = null;
    try {
      const old = JSON.parse(
        await readFile(resolve(process.cwd(), ".local/chat-usage.json"), "utf8"),
      );
      if (typeof old.day === "string" && Number.isSafeInteger(old.count) && old.count >= 0)
        utilizadas = old.day === diaLima(new Date().toISOString()) ? old.count : 0;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") utilizadas = 0;
    }
    return Response.json(
      {
        ...resumirMetricas(store, filters.data),
        cupo: { limite: config.limit, utilizadas },
        modelo: config.model,
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "No se pudo consultar la medición del chatbot. Reintenta." },
      { status: 503, headers },
    );
  }
}
