import { recordarAviso } from "@/lib/ux-feedback";
import { CampoContrasena } from "@/components/CampoContrasena";
import { useAvisoError } from "@/lib/ux-feedback";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { jsonApi, storeHeaders, useSesion } from "@/context/tienda";
export const Route = createFileRoute("/acceso")({
  validateSearch: (s: Record<string, unknown>) => ({
    destino: s["destino"] === "admin" ? "admin" : s["destino"] === "carrito" ? "carrito" : "cuenta",
  }),
  component: Acceso,
});
function Acceso() {
  const { destino } = Route.useSearch();
  const session = useSesion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useAvisoError(error);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const d = await jsonApi("/api/sesion", {
        method: "POST",
        headers: storeHeaders,
        body: JSON.stringify({ login: f.get("login"), password: f.get("password") }),
      });
      recordarAviso("Iniciaste sesión correctamente. ¡Bienvenido!");
      window.location.assign(
        d.sesion.rol === "admin" ? "/admin" : destino === "carrito" ? "/carrito" : "/mi-cuenta",
      );
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto my-12 max-w-md px-5">
      <div className="rounded-3xl border bg-white p-7 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {destino === "admin" ? "Equipo de gestión" : "Bienvenido de nuevo"}
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          {destino === "admin" ? "Administración" : "Entra a tu cuenta"}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {destino === "admin"
            ? "Usa tu usuario administrador y contraseña de Dolibarr."
            : "Consulta tus compras, documentos y saldos."}
        </p>
        {session.data?.sesion && (
          <a
            className="mt-4 block text-sm underline"
            href={session.data.sesion.rol === "admin" ? "/admin" : "/mi-cuenta"}
          >
            Continuar con mi sesión actual →
          </a>
        )}
        <form aria-busy={busy} onSubmit={submit} className="mt-7 space-y-5">
          <label className="block space-y-2 text-sm">
            <span>{destino === "admin" ? "Usuario" : "Correo o usuario"}</span>
            <Input name="login" autoComplete="username" required maxLength={150} />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Contraseña</span>
            <CampoContrasena
              name="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button className="w-full rounded-full" disabled={busy}>
            {busy ? "Entrando…" : "Iniciar sesión"}
          </Button>
        </form>
        {destino !== "admin" && session.isSuccess && !session.data?.sesion && (
          <p className="mt-6 text-center text-sm">
            ¿Primera compra?{" "}
            <Link to="/registro" className="font-semibold text-primary">
              Crea tu cuenta
            </Link>
          </p>
        )}
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">
        Si ya eres cliente y todavía no tienes acceso, solicita a administración que vincule tu
        usuario.
      </p>
    </div>
  );
}
