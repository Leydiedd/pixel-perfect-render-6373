import { leerMetricas, comenzarMedicion } from "./chat-metrics.server";
import { resolve } from "node:path";
import { portalPhp, sesionActual, leerJson } from "./auth.server";
import { origenLocal, type Catalogo, type Cuenta } from "./store-model";
import { responderDolibarr } from "./dolibarr.server";
import { datosSchema, type DatosDolibarr } from "./dolibarr-model";
import { hoyLima } from "./delivery-model";
import { cargarConfigChat, reservarConsulta } from "./chat-config.server";
import { chatSchema, conversar, ErrorChat, transporteOpenAI } from "./chat-engine";
import { canalAutorizado } from "./chat-tools";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const shared = globalThis as typeof globalThis & {
  bimboChatGuard?: Map<number, { n: number; until: number; busy: boolean }>;
};
const guard = (shared.bimboChatGuard ??= new Map());
export async function asistenteApi(request: Request) {
  if (!origenLocal(request, request.method !== "GET"))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  let medicion: Awaited<ReturnType<typeof comenzarMedicion>> | undefined;
  let release: (() => void) | undefined;
  try {
    const s = await sesionActual(request);
    if (!s)
      return Response.json(
        { error: "Inicia sesión para consultar al asistente." },
        { status: 401, headers },
      );
    const config = await cargarConfigChat();
    if (request.method === "GET")
      return Response.json(
        {
          disponible: !!config.key,
          ...(s.rol === "admin" ? { modelo: config.model, limiteDiario: config.limit } : {}),
        },
        { headers },
      );
    if (!config.key)
      throw new ErrorChat(
        s.rol === "admin"
          ? "Falta configurar OPENAI_API_KEY en .local/openai.env del servidor."
          : "El asistente todavía no está habilitado. Puedes consultar el catálogo y tu cuenta.",
      );
    let parsed;
    try {
      parsed = chatSchema.safeParse(await leerJson(request, 26000));
    } catch {
      return Response.json(
        { error: "Envía una consulta de hasta 1000 caracteres." },
        { status: 400, headers },
      );
    }
    if (!parsed.success)
      return Response.json(
        { error: "Consulta inválida. Abre una nueva conversación e intenta de nuevo." },
        { status: 400, headers },
      );
    const now = Date.now();
    for (const [key, value] of guard) if (value.until < now && !value.busy) guard.delete(key);
    const g = guard.get(s.id) ?? { n: 0, until: now + 60000, busy: false };
    if (g.busy || g.n >= 6)
      throw new ErrorChat(
        "Espera a que termine tu consulta o inténtalo de nuevo en un minuto.",
        429,
      );
    g.n++;
    g.busy = true;
    guard.set(s.id, g);
    release = () => {
      g.busy = false;
    };
    await leerMetricas();
    await reservarConsulta(resolve(process.cwd(), ".local"), hoyLima(), config.limit);
    const canal = canalAutorizado(s, parsed.data.canal);
    let catalog: Promise<Catalogo> | undefined,
      account: Promise<Cuenta> | undefined,
      snapshot: Promise<DatosDolibarr> | undefined;
    const context = {
      sesion: s,
      canal,
      carrito: parsed.data.carrito,
      hoy: hoyLima(),
      catalogo: () =>
        (catalog ??= portalPhp("catalog", {
          customerId: s.rol === "cliente" ? s.clienteId : null,
          canal,
        }).then((r) => {
          if (!r.ok) throw new Error("Catalog unavailable");
          return r;
        })),
      cuenta: () => {
        if (s.rol !== "cliente" || !s.clienteId) throw new Error("Forbidden");
        return (account ??= portalPhp("account", { userId: s.id }).then((r) => {
          if (!r.ok) throw new Error("Account unavailable");
          return r;
        }));
      },
      administracion: () => {
        if (s.rol !== "admin") throw new Error("Forbidden");
        return (snapshot ??= responderDolibarr(
          new Request(new URL("/api/dolibarr", request.url), { headers: request.headers }),
        ).then(async (r) => {
          if (!r.ok) throw new Error("Snapshot unavailable");
          return datosSchema.parse(await r.json());
        }));
      },
    };
    medicion = await comenzarMedicion(s, canal, config.model);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(90000)]);
    const result = await conversar(
      parsed.data,
      context,
      medicion.envolver(transporteOpenAI(config, signal)),
    );
    await medicion.terminar("respondida");
    medicion = undefined;
    return Response.json(result, { headers });
  } catch (e) {
    await medicion?.terminar("error").catch(() => {});
    return Response.json(
      {
        error:
          e instanceof ErrorChat
            ? e.message
            : "No se pudo consultar al asistente. Comprueba la conexión e inténtalo nuevamente.",
      },
      { status: e instanceof ErrorChat ? e.status : 503, headers },
    );
  } finally {
    release?.();
  }
}
