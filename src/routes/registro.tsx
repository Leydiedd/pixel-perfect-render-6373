import { recordarAviso } from "@/lib/ux-feedback";
import { CampoContrasena } from "@/components/CampoContrasena";
import { useAvisoError } from "@/lib/ux-feedback";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { jsonApi, storeHeaders, useTienda, useSesion } from "@/context/tienda";
import { registroSchema } from "@/lib/store-model";
export const Route = createFileRoute("/registro")({ component: Registro });
function Registro() {
  const { canal, cambiarCanal } = useTienda();
  const s = useSesion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useAvisoError(error);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = { ...Object.fromEntries(form), canal };
    const parsed = registroSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Revisa los datos");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await jsonApi("/api/registro", {
        method: "POST",
        headers: storeHeaders,
        body: JSON.stringify(parsed.data),
      });
      recordarAviso("Tu cuenta fue creada. Ya puedes comenzar a comprar.");
      window.location.assign("/carrito");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  if (s.data?.sesion)
    return (
      <div className="mx-auto max-w-xl space-y-4 px-5 py-16">
        <h1 className="text-2xl font-bold">Ya tienes una sesión abierta</h1>
        <p>Cierra la sesión actual para registrar otra cuenta.</p>
        <Link to="/" className="underline">
          Volver a la tienda
        </Link>
      </div>
    );
  return (
    <div className="mx-auto my-10 max-w-2xl px-5">
      <div className="rounded-3xl border bg-white p-7 sm:p-10">
        <h1 className="text-3xl font-bold">Un lugar para tus compras</h1>
        <p className="mt-3 text-sm text-slate-500">
          Crea tu cuenta para comprar y consultar tus documentos.
        </p>
        <div className="my-6 grid grid-cols-2 gap-3">
          {(["b2c", "b2b"] as const).map((c) => (
            <button
              key={c}
              onClick={() => cambiarCanal(c)}
              className={`rounded-xl border p-4 text-left ${canal === c ? "border-navy bg-navy-soft" : "border-slate-200"}`}
            >
              <strong className="text-sm">
                {c === "b2c" ? "Soy una persona" : "Tengo un negocio"}
              </strong>
              <span className="mt-1 block text-xs text-slate-500">
                {c === "b2c" ? "Compras para consumo personal" : "Compras para mi empresa o bodega"}
              </span>
            </button>
          ))}
        </div>
        <form aria-busy={busy} onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm sm:col-span-2">
            <span>{canal === "b2b" ? "Razón social" : "Nombre completo"}</span>
            <Input
              name="nombre"
              autoComplete="organization"
              required
              minLength={3}
              maxLength={120}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Nombre de contacto</span>
            <Input name="contacto" autoComplete="name" required minLength={3} maxLength={100} />
          </label>
          <label className="space-y-2 text-sm">
            <span>{canal === "b2b" ? "RUC" : "DNI o RUC"}</span>
            <Input
              name="documento"
              inputMode="numeric"
              required
              pattern={canal === "b2b" ? "[0-9]{11}" : "[0-9]{8}|[0-9]{11}"}
              maxLength={11}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Correo electrónico</span>
            <Input name="correo" type="email" autoComplete="email" required maxLength={150} />
          </label>
          <label className="space-y-2 text-sm">
            <span>Teléfono</span>
            <Input
              name="telefono"
              type="tel"
              autoComplete="tel"
              required
              minLength={7}
              maxLength={25}
            />
          </label>
          <label className="space-y-2 text-sm sm:col-span-2">
            <span>{canal === "b2b" ? "Dirección de la empresa" : "Dirección"}</span>
            <Input
              name="direccion"
              autoComplete="street-address"
              required
              minLength={5}
              maxLength={200}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Ciudad / distrito</span>
            <Input
              name="ciudad"
              autoComplete="address-level2"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Contraseña · mínimo 10 caracteres</span>
            <CampoContrasena
              name="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          )}
          <Button disabled={busy} className="rounded-full sm:col-span-2">
            {busy ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Las cuentas de negocio usan los precios publicados. El registro no concede crédito ni
          descuentos especiales.
        </p>
        <p className="mt-5 text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link to="/acceso" search={{ destino: "cuenta" }} className="text-primary underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
