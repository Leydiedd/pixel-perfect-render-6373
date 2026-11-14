import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { loginSchema, registroSchema, origenLocal, type Sesion } from "./store-model";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const cookieName = "bimbo_session";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const sessionDir = () =>
  resolve(
    process.cwd(),
    ".local",
    "sessions",
    digest(
      (process.env["DOLIBARR_CONFIG_PATH"] || "default") +
        ":" +
        (process.env["DOLIBARR_ENTITY"] || "1"),
    ),
  );
export function portalPhp(mode: string, data: unknown = {}): Promise<any> {
  return new Promise((ok, fail) => {
    const child = spawn(
      process.env["DOLIBARR_PHP_BINARY"] || "C:/xampp/php/php.exe",
      [resolve(process.cwd(), "server/dolibarr-store.php"), mode],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      fail(new Error("Timeout"));
    }, 45_000);
    child.stdout.on("data", (b) => {
      output += b;
      if (output.length > 5_000_000) child.kill();
    });
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    child.on("error", (e) => {
      clearTimeout(timer);
      fail(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0) throw new Error("Adapter failed");
        ok(JSON.parse(output));
      } catch (e) {
        fail(e);
      }
    });
    child.stdin.end(JSON.stringify(data));
  });
}
function tokenOf(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function revoke(request: Request) {
  const token = tokenOf(request);
  if (token) await unlink(resolve(sessionDir(), digest(token) + ".json")).catch(() => {});
}
function cookie(request: Request, token: string, age = 28800) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function sesionActual(request: Request): Promise<Sesion | null> {
  if (!origenLocal(request)) return null;
  const token = tokenOf(request);
  if (!token) return null;
  let stored;
  try {
    stored = JSON.parse(await readFile(resolve(sessionDir(), digest(token) + ".json"), "utf8"));
  } catch {
    return null;
  }
  if (stored.expira < Date.now()) {
    await revoke(request);
    return null;
  }
  const result = await portalPhp("session", stored);
  if (!result.ok) {
    await revoke(request);
    return null;
  }
  return result.sesion;
}
export async function exigirAdmin(request: Request): Promise<Response | null> {
  if (!origenLocal(request))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  try {
    const s = await sesionActual(request);
    if (!s)
      return Response.json({ error: "Inicia sesión para continuar." }, { status: 401, headers });
    if (s.rol !== "admin")
      return Response.json(
        { error: "Acceso reservado a administración." },
        { status: 403, headers },
      );
    return null;
  } catch {
    return Response.json({ error: "No se pudo comprobar la sesión." }, { status: 503, headers });
  }
}
export async function leerJson(request: Request, max = 16384) {
  if (Number(request.headers.get("content-length") || 0) > max) throw new Error("Size");
  const text = await request.text();
  if (text.length > max) throw new Error("Size");
  return JSON.parse(text);
}
// Shared across hot reloads; local adapter never trusts forwarded IP headers.
const rateGlobal = globalThis as typeof globalThis & {
  bimboAuthAttempts?: Map<string, { n: number; until: number }>;
};
const attempts = (rateGlobal.bimboAuthAttempts ??= new Map());
function allowed(key: string, limit: number) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const a = attempts.get(key) || { n: 0, until: now + 15 * 60_000 };
  a.n++;
  attempts.set(key, a);
  return a.n <= limit;
}
export async function manejarSesion(request: Request, registrar = false): Promise<Response> {
  const write = request.method !== "GET";
  if (!origenLocal(request, write))
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  try {
    if (request.method === "GET")
      return Response.json({ sesion: await sesionActual(request) }, { headers });
    if (request.method === "DELETE") {
      await revoke(request);
      return Response.json(
        { ok: true },
        { headers: { ...headers, "Set-Cookie": cookie(request, "", 0) } },
      );
    }
    let parsed;
    try {
      parsed = (registrar ? registroSchema : loginSchema).safeParse(await leerJson(request));
    } catch {
      return Response.json({ error: "Revisa los datos del formulario." }, { status: 400, headers });
    }
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos." },
        { status: 400, headers },
      );
    const key = digest(
      "login" in parsed.data ? parsed.data.login.toLowerCase() : parsed.data.correo,
    );
    if (!allowed(registrar ? "register" : "login", registrar ? 12 : 60) || !allowed(key, 10))
      return Response.json(
        { error: "Demasiados intentos. Espera 15 minutos antes de volver a intentar." },
        { status: 429, headers },
      );
    const result = await portalPhp(registrar ? "register" : "login", parsed.data);
    if (!result.ok)
      return Response.json(
        { error: result.error },
        { status: [400, 401, 403, 409].includes(result.status) ? result.status : 503, headers },
      );
    await revoke(request);
    const token = randomBytes(32).toString("hex");
    await mkdir(sessionDir(), { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(sessionDir(), digest(token) + ".json"),
      JSON.stringify({
        userId: result.sesion.id,
        stamp: result.stamp,
        issuedAt: Math.floor(Date.now() / 1000),
        expira: Date.now() + 8 * 60 * 60_000,
      }),
      { mode: 0o600, flag: "wx" },
    );
    return Response.json(
      { sesion: result.sesion },
      { headers: { ...headers, "Set-Cookie": cookie(request, token) } },
    );
  } catch {
    return Response.json(
      {
        error: registrar
          ? "No se pudo confirmar el registro. Si ya se creó, puedes iniciar sesión con tu correo."
          : "No se pudo conectar con Dolibarr. Intenta nuevamente.",
      },
      { status: 503, headers },
    );
  }
}
