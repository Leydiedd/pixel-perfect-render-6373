import { readFile, mkdir, writeFile, rename, unlink, stat, open } from "node:fs/promises";
import { resolve } from "node:path";
import { ErrorChat } from "./chat-engine.ts";

const configKeys = ["OPENAI_API_KEY", "OPENAI_MODEL", "CHAT_DAILY_MESSAGES"];
export function parseChatConfig(
  text: string,
  env: Record<string, string | undefined> = process.env,
) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match?.[1] && configKeys.includes(match[1]))
      values[match[1]] = (match[2] ?? "").replace(/^(["'])(.*)\1$/, "$2");
  }
  for (const k of configKeys) if (env[k]?.trim()) values[k] = env[k]!.trim();
  const key = values["OPENAI_API_KEY"]?.trim() ?? "";
  const model = values["OPENAI_MODEL"] || "gpt-4.1-mini";
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model))
    throw new ErrorChat("Revisa OPENAI_MODEL en la configuración del servidor.");
  const limit = Number(values["CHAT_DAILY_MESSAGES"] || 60);
  if (!Number.isInteger(limit) || limit < 0 || limit > 1000)
    throw new ErrorChat("CHAT_DAILY_MESSAGES debe ser 0 (sin límite diario) o un entero entre 1 y 1000.");
  return { key, model, limit };
}
export async function cargarConfigChat() {
  let text = "";
  try {
    text = await readFile(resolve(process.cwd(), ".local/openai.env"), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new ErrorChat("No se pudo leer la configuración del asistente.");
  }
  return parseChatConfig(text);
}
// A file lock shares the daily ceiling across the desktop and Wi-Fi Node processes.
// Only a date and counter are stored, never conversation content or credentials.
export async function reservarConsulta(dir: string, day: string, limit: number) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = resolve(dir, "chat-usage.lock"),
    file = resolve(dir, "chat-usage.json");
  let handle;
  try {
    handle = await open(lock, "wx", 0o600);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") {
      const stale = await stat(lock).catch(() => null);
      if (stale && Date.now() - stale.mtimeMs > 120000) await unlink(lock).catch(() => {});
      throw new ErrorChat(
        "Hay otra consulta iniciándose. Espera un momento y vuelve a enviar.",
        429,
      );
    }
    throw e;
  }
  try {
    let data: { day: string; count: number } = { day, count: 0 };
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw new ErrorChat("No se pudo comprobar el límite de uso del asistente.");
    }
    if (typeof data.day !== "string" || !Number.isSafeInteger(data.count) || data.count < 0)
      throw new ErrorChat("No se pudo comprobar el límite de uso del asistente.");
    const count = data.day === day ? data.count : 0;
    if (limit > 0 && count >= limit)
      throw new ErrorChat(
        "Se alcanzó el límite diario del asistente. Estará disponible nuevamente mañana.",
        429,
      );
    const temp = file + ".tmp";
    await writeFile(temp, JSON.stringify({ day, count: count + 1 }), { mode: 0o600 });
    await rename(temp, file);
  } finally {
    await handle.close();
    await unlink(lock).catch(() => {});
  }
}
