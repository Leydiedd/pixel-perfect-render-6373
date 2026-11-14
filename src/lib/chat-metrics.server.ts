import { readFile, writeFile, mkdir, open, unlink, rename, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  metricasSchema,
  medirRespuesta,
  type MetricasChat,
  type RegistroChat,
} from "./chat-metrics-model.ts";
import type { Sesion } from "./store-model";
const defaultDir = () => resolve(process.cwd(), ".local");
async function transaccion<T>(dir: string, fn: (data: MetricasChat) => T | Promise<T>): Promise<T> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = resolve(dir, "chat-metrics.json"),
    lock = file + ".lock";
  let handle;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      handle = await open(lock, "wx", 0o600);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const info = await stat(lock).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 120000) await unlink(lock).catch(() => {});
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  if (!handle) throw new Error("Registro de consumo ocupado. Reintenta.");
  try {
    let data: MetricasChat;
    try {
      data = metricasSchema.parse(JSON.parse(await readFile(file, "utf8")));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("No se pudo leer el registro de consumo.");
      let previas: MetricasChat["previas"] = null;
      try {
        const old = JSON.parse(await readFile(resolve(dir, "chat-usage.json"), "utf8"));
        if (typeof old.day === "string" && Number.isSafeInteger(old.count) && old.count >= 0)
          previas = { dia: old.day, consultas: old.count };
      } catch {}
      data = { version: 1, inicio: new Date().toISOString(), previas, saldo: null, consultas: [] };
    }
    const result = await fn(data);
    await writeFile(file + ".tmp", JSON.stringify(data), { mode: 0o600 });
    await rename(file + ".tmp", file);
    return result;
  } finally {
    await handle.close();
    await unlink(lock).catch(() => {});
  }
}
export async function leerMetricas(dir = defaultDir()) {
  return transaccion(dir, (d) => d);
}
export async function guardarSaldo(usd: number, revision: string | null, dir = defaultDir()) {
  return transaccion(dir, (d) => {
    if ((d.saldo?.revision ?? null) !== revision)
      throw new Error("El saldo fue actualizado. Recarga y revisa el valor antes de guardarlo.");
    d.saldo = { usd, fecha: new Date().toISOString(), revision: randomUUID() };
    return d.saldo;
  });
}
export async function comenzarMedicion(
  s: Sesion,
  canal: "b2b" | "b2c",
  modelo: string,
  dir = defaultDir(),
) {
  const id = randomUUID();
  const registro: RegistroChat = {
    id,
    fecha: new Date().toISOString(),
    fin: null,
    usuarioId: s.id,
    usuario: s.nombre,
    rol: s.rol,
    canal,
    estado: "en_curso",
    llamadas: [],
  };
  await transaccion(dir, (d) => {
    d.consultas.push(registro);
  });
  const update = async () =>
    transaccion(dir, (d) => {
      const i = d.consultas.findIndex((r) => r.id === id);
      if (i < 0) throw new Error("Registro de consulta ausente.");
      d.consultas[i] = registro;
    });
  return {
    envolver:
      (transport: (body: Record<string, unknown>) => Promise<any>) =>
      async (body: Record<string, unknown>) => {
        const call: RegistroChat["llamadas"][number] = {
          inicio: new Date().toISOString(),
          fin: null,
          modelo,
          estado: "en_curso",
          entrada: null,
          cache: null,
          salida: null,
          costoNano: null,
        };
        registro.llamadas.push(call);
        await update(); // Persist intent before any billable call.
        try {
          const r = await transport(body);
          Object.assign(call, medirRespuesta(r), {
            fin: new Date().toISOString(),
            estado: "recibida",
          });
          await update();
          return r;
        } catch (e) {
          call.fin = new Date().toISOString();
          call.estado = "error";
          await update();
          throw e;
        }
      },
    terminar: async (estado: "respondida" | "error") => {
      registro.estado = estado;
      registro.fin = new Date().toISOString();
      await update();
    },
  };
}
