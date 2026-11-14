import { ProductoImagen } from "@/components/ProductoImagen";
import { crearSolicitudId } from "@/lib/solicitud-id";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, CheckCircle2, ShoppingBag } from "lucide-react";
import { useTienda, useCatalogo, useSesion, jsonApi, storeHeaders } from "@/context/tienda";
import {
  compraSchema,
  lineasCarrito,
  condicionMayorista,
  type Compra,
  type Cuenta,
} from "@/lib/store-model";
import { CondicionMayorista } from "@/components/CondicionMayorista";
import { formatoMoneda } from "@/lib/dolibarr-model";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/carrito")({ component: Carrito });
function Carrito() {
  const { carrito, cantidad, vaciar, listo, canal } = useTienda();
  const catalogo = useCatalogo();
  const session = useSesion();
  const user = session.data?.sesion;
  const account = useQuery<Cuenta>({
    queryKey: ["cuenta", user?.id],
    queryFn: () => jsonApi("/api/cuenta"),
    enabled: user?.rol === "cliente",
    retry: false,
  });
  const [tipo, setTipo] = useState<"delivery" | "recojo">("delivery");
  const [entrega, setEntrega] = useState({ contacto: "", telefono: "", direccion: "", ciudad: "" });
  const [pending, setPending] = useState<Compra | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useAvisoError(error);
  const [editable, setEditable] = useState(false);
  const [done, setDone] = useState<{
    pedido: { ref: string; total: number };
    factura: { ref: string; id: number };
    aviso: string | null;
  } | null>(null);
  const key = `bimbo-store-pending-v1-${user?.id}`;
  const prefilled = useRef<number | null>(null);
  useEffect(() => {
    setLoaded(false);
    setPending(null);
    if (user?.rol !== "cliente") {
      setLoaded(true);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved) {
        const p = compraSchema.safeParse(saved);
        if (p.success) {
          setPending(p.data);
          setEntrega(p.data.entrega);
          setTipo(p.data.entrega.tipo ?? "delivery");
        }
      }
    } catch {}
    setLoaded(true);
  }, [key, user?.rol]);
  useEffect(() => {
    if (pending) {
      prefilled.current = user?.id || null;
      return;
    }
    if (account.data && prefilled.current !== user?.id) {
      const p = account.data.perfil;
      setEntrega({
        contacto: p.contacto || p.nombre,
        telefono: p.telefono || "",
        direccion: p.direccion || "",
        ciudad: p.ciudad || "",
      });
      prefilled.current = user?.id || null;
    }
  }, [account.data, pending, user?.id]);
  const items = lineasCarrito(carrito, catalogo.data, pending);
  const condicion = condicionMayorista(carrito, catalogo.data);
  const subtotal = items.reduce((s, l) => s + l.precio * l.cantidad, 0),
    impuesto = items.reduce((s, l) => s + (l.precio * l.cantidad * l.impuesto) / 100, 0);
  const invalid = items.some((l) => !l.p || !l.p.comprable || l.cantidad > l.p.disponible);
  const locked = busy || !!pending;
  async function comprar() {
    if (!user || user.rol !== "cliente") return;
    setError("");
    setEditable(false);
    let payload = pending;
    if (!payload) {
      const parsed = compraSchema.safeParse({
        solicitudId: crearSolicitudId(),
        canal,
        entrega: { ...entrega, tipo, ...(tipo === "recojo" ? { direccion: "", ciudad: "" } : {}) },
        lineas: items.map((l) => ({
          productoId: l.id,
          cantidad: l.cantidad,
          precioEsperado: l.precio,
          impuestoEsperado: l.impuesto,
        })),
      });
      if (!parsed.success) {
        setError(
          tipo === "recojo"
            ? "Completa el nombre y teléfono de quien recogerá el pedido."
            : "Completa el contacto, teléfono y dirección de entrega.",
        );
        return;
      }
      payload = parsed.data;
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        setError("Activa el almacenamiento del navegador para confirmar sin duplicar pedidos.");
        return;
      }
      setPending(payload);
    }
    setBusy(true);
    try {
      const r = await fetch("/api/compra", {
        method: "POST",
        headers: storeHeaders,
        body: JSON.stringify(payload),
      });
      const result = await r.json();
      if (!r.ok) {
        setError(result.error || "No se pudo confirmar.");
        setEditable(result.revisable === true);
        return;
      }
      toast.success("Pedido registrado", {
        description: "Puedes consultar su factura y seguimiento en Mi cuenta.",
      });
      setDone(result);
      localStorage.removeItem(key);
      setPending(null);
      vaciar();
      void account.refetch();
      void catalogo.refetch();
    } catch {
      setError("La conexión se interrumpió. Reintenta el mismo pedido; no se creará un duplicado.");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="mx-auto my-14 max-w-xl space-y-5 rounded-3xl border bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-green-700" />
        <h1 className="text-3xl font-bold">Tu pedido está registrado</h1>
        <p>
          Pedido <strong>{done.pedido.ref}</strong> · Factura <strong>{done.factura.ref}</strong>
        </p>
        <p className="text-2xl font-bold">
          {formatoMoneda(done.pedido.total, catalogo.data?.moneda)}
        </p>
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {account.data?.pasarelaDemo
            ? "Tu factura está pendiente de pago. Puedes pagar con tarjeta, Yape o Plin en Mis facturas."
            : "Tu factura está pendiente de pago. Administración registrará el cobro recibido."}
        </p>
        <p className="text-sm">
          {tipo === "recojo"
            ? "Recojo en tienda: te avisaremos cuando esté listo para recoger."
            : "Delivery: consulta la programación de entrega en Mi cuenta."}
        </p>
        {account.data?.pasarelaDemo && (
          <Button asChild className="rounded-full">
            <Link to="/mi-cuenta" hash="mis-facturas">
              Ir a pagar mi factura
            </Link>
          </Button>
        )}
        {done.aviso && <p className="text-sm">{done.aviso}</p>}
        <Button asChild className="rounded-full">
          <Link to="/mi-cuenta">Ver mis pedidos</Link>
        </Button>
        <Link to="/" className="block text-sm underline">
          Seguir comprando
        </Link>
      </div>
    );
  if (!listo || !loaded || catalogo.isPending || session.isPending)
    return <p className="p-12 text-center">Preparando tu carrito…</p>;
  if (!carrito.length && !pending)
    return (
      <div className="space-y-5 px-5 py-20 text-center">
        <ShoppingBag className="mx-auto size-12 text-slate-400" />
        <h1 className="text-3xl font-bold">Tu carrito está esperando</h1>
        <p>Encuentra algo rico para tu hogar o tu negocio.</p>
        <Button asChild className="rounded-full">
          <Link to="/">Explorar productos</Link>
        </Button>
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link to="/" className="text-sm text-slate-500">
        ← Seguir comprando
      </Link>
      <h1 className="mb-4 mt-4 text-3xl font-bold">Tu carrito</h1>
      <p className="mb-5 text-sm text-slate-600">
        Compra para {(pending?.canal ?? canal) === "b2c" ? "mi hogar" : "mi negocio"}.
        {user?.canal === "b2b" &&
          (pending?.canal ?? canal) === "b2c" &&
          " Se usa el precio normal; el pedido y la factura quedan a nombre de tu cliente registrado."}
        {pending && " El envío pendiente conserva la modalidad elegida al confirmar."}
      </p>
      {!pending && <CondicionMayorista condicion={condicion} moneda={catalogo.data?.moneda} />}
      {catalogo.data?.tarifa && (
        <p className="mb-5 text-sm text-slate-600">
          {pending
            ? "Importes conservados del envío pendiente."
            : `Tarifa aplicada: ${condicion.tarifa}.`}{" "}
          El total incluye los impuestos indicados.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6">
          <div className="divide-y rounded-2xl border bg-white px-5">
            {items.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-4 py-5">
                <ProductoImagen
                  src={l.p?.foto ?? null}
                  alt={l.p?.nombre || "Producto no disponible"}
                  compact
                  className="size-16 shrink-0 border border-slate-100 sm:size-20"
                />
                <div className="min-w-0 flex-1 basis-36 break-words">
                  <p className="font-semibold">{l.p?.nombre || "Producto no disponible"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {l.p?.sku} · {formatoMoneda(l.precioFinal, catalogo.data?.moneda)} con impuestos
                  </p>
                  {l.p && l.cantidad > l.p.disponible && (
                    <p className="text-xs text-red-700">Disponible para compra: {l.p.disponible}</p>
                  )}
                </div>
                <Input
                  className="w-20"
                  aria-label={`Cantidad de ${l.p?.nombre}`}
                  type="number"
                  min={1}
                  step={1}
                  max={l.p?.disponible || 1}
                  value={l.cantidad}
                  disabled={locked}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n > 0) cantidad(l.id, n);
                  }}
                />
                <ConfirmarAccion
                  variant="ghost"
                  size="icon"
                  disabled={locked}
                  aria-label={`Quitar ${l.p?.nombre}`}
                  titulo="¿Quitar producto del carrito?"
                  descripcion={l.p?.nombre || "Este producto se quitará de tu selección."}
                  confirmar="Quitar producto"
                  onConfirm={() => {
                    cantidad(l.id, 0);
                    toast.success("Producto quitado del carrito");
                  }}
                >
                  <Trash2 className="size-4" />
                </ConfirmarAccion>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold">¿Cómo quieres recibir tu pedido?</h2>
            <fieldset
              disabled={locked}
              className="mb-5 grid gap-3 sm:grid-cols-2"
              aria-label="Modalidad de entrega"
            >
              <label
                className={`cursor-pointer rounded-xl border p-4 ${tipo === "delivery" ? "border-primary bg-red-50" : ""}`}
              >
                <input
                  type="radio"
                  name="modalidad"
                  value="delivery"
                  checked={tipo === "delivery"}
                  onChange={() => setTipo("delivery")}
                />{" "}
                <strong>Delivery</strong>
                <p className="mt-1 text-xs text-slate-600">Recíbelo en tu dirección.</p>
              </label>
              <label
                className={`cursor-pointer rounded-xl border p-4 ${tipo === "recojo" ? "border-primary bg-red-50" : ""}`}
              >
                <input
                  type="radio"
                  name="modalidad"
                  value="recojo"
                  checked={tipo === "recojo"}
                  disabled={!account.data?.puntoRecojo}
                  onChange={() => setTipo("recojo")}
                />{" "}
                <strong>Recojo en tienda</strong>
                <p className="mt-1 text-xs text-slate-600">
                  Recoge cuando te avisemos que está listo.
                </p>
              </label>
            </fieldset>
            {tipo === "recojo" && (
              <p className="mb-4 rounded-xl bg-blue-50 p-4 text-sm">
                <strong>Punto de recojo:</strong> {account.data?.puntoRecojo}
              </p>
            )}
            <h3 className="mb-4 font-semibold">
              {tipo === "recojo" ? "¿Quién recogerá el pedido?" : "Datos de entrega"}
            </h3>
            {user?.rol === "cliente" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["contacto", "Persona que recibe"],
                    ["telefono", "Teléfono"],
                    ["direccion", "Dirección completa"],
                    ["ciudad", "Ciudad / distrito"],
                  ] as const
                )
                  .filter(
                    ([field]) =>
                      tipo === "delivery" || field === "contacto" || field === "telefono",
                  )
                  .map(([field, label]) => (
                    <label
                      key={field}
                      className={`space-y-2 text-sm ${field === "direccion" ? "sm:col-span-2" : ""}`}
                    >
                      <span>
                        {field === "contacto" && tipo === "recojo" ? "Persona que recoge" : label}
                      </span>
                      <Input
                        value={entrega[field]}
                        disabled={locked}
                        maxLength={field === "direccion" ? 200 : field === "telefono" ? 25 : 100}
                        onChange={(e) => setEntrega({ ...entrega, [field]: e.target.value })}
                      />
                    </label>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {user?.rol === "admin"
                  ? "Para comprar en la tienda, utiliza una cuenta de cliente."
                  : "Inicia sesión o crea tu cuenta para confirmar la compra."}
              </p>
            )}
          </div>
        </section>
        <aside className="h-fit space-y-5 rounded-2xl bg-[#20344e] p-7 text-white">
          <h2 className="text-xl font-semibold">Resumen del pedido</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Productos sin impuestos</dt>
              <dd>{formatoMoneda(subtotal, catalogo.data?.moneda)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Impuestos</dt>
              <dd>{formatoMoneda(impuesto, catalogo.data?.moneda)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/20 pt-4 text-xl font-bold">
              <dt>Total de productos</dt>
              <dd>{formatoMoneda(subtotal + impuesto, catalogo.data?.moneda)}</dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-white/70">
            {tipo === "recojo"
              ? "Recojo en tienda. Espera la notificación de pedido listo antes de acercarte."
              : "El delivery y cualquier costo adicional se coordinan con administración. Este pedido no incluye un cargo de envío."}{" "}
            {account.data?.pasarelaDemo
              ? "Después de confirmar puedes pagar desde Mis facturas."
              : "Administración registrará el cobro recibido."}
          </p>
          {catalogo.isError && (
            <p role="alert" className="text-sm text-amber-200">
              No se pudo actualizar el catálogo.{" "}
              <button className="underline" onClick={() => void catalogo.refetch()}>
                Reintentar
              </button>
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-white/10 p-3 text-sm text-amber-100">
              {error}
            </p>
          )}
          {pending && (
            <p className="text-sm text-amber-100">
              Hay un envío pendiente de confirmar. Reintenta para recuperar su resultado con la
              misma referencia.
            </p>
          )}
          {user?.rol === "cliente" ? (
            <>
              <Button
                className="w-full rounded-full"
                disabled={busy || (!pending && (invalid || !carrito.length || catalogo.isError))}
                onClick={() => void comprar()}
              >
                {busy
                  ? "Confirmando…"
                  : pending
                    ? "Reintentar el mismo pedido"
                    : "Confirmar pedido"}
              </Button>
              {editable && pending && (
                <button
                  className="w-full text-sm underline"
                  onClick={() => {
                    localStorage.removeItem(key);
                    setPending(null);
                    setEditable(false);
                    setError("");
                    void catalogo.refetch();
                  }}
                >
                  Corregir el pedido rechazado
                </button>
              )}
            </>
          ) : user?.rol === "admin" ? (
            <Button asChild variant="secondary" className="w-full">
              <Link to="/admin/pedido">Crear desde administración</Link>
            </Button>
          ) : (
            <div className="space-y-3">
              <Button asChild className="w-full rounded-full">
                <Link to="/acceso" search={{ destino: "carrito" }}>
                  Iniciar sesión para comprar
                </Link>
              </Button>
              <Link to="/registro" className="block text-center text-sm underline">
                Crear cuenta
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
