import { AsistenteChat } from "./AsistenteChat";
import { ConfirmarAccion } from "./ConfirmarAccion";
import { recordarAviso } from "@/lib/ux-feedback";
import { NotificacionesCliente } from "@/components/NotificacionesCliente";
import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingBag, ArrowUpRight, LogOut, Store, House, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useSesion, TiendaProvider, useTienda, jsonApi, storeHeaders } from "@/context/tienda";
import { ProveedorDolibarr } from "@/context/dolibarr";
import { ProveedorPedido } from "@/context/pedido";
import { EncabezadoApp } from "./EncabezadoApp";
import { BarraLateral } from "./BarraLateral";
import { Button } from "./ui/button";
async function salir() {
  await jsonApi("/api/sesion", { method: "DELETE", headers: storeHeaders, body: "{}" });
  localStorage.removeItem("bimbo-tienda-cart-v1");
  recordarAviso("Cerraste sesión correctamente.");
  window.location.assign("/");
}
export function PortalShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return pathname.startsWith("/admin") ? (
    <AdminShell>{children}</AdminShell>
  ) : (
    <TiendaProvider>
      <StoreShell>{children}</StoreShell>
    </TiendaProvider>
  );
}
function AdminShell({ children }: { children: ReactNode }) {
  const session = useSesion();
  if (session.isPending) return <div className="p-12 text-center">Comprobando acceso…</div>;
  if (session.isError)
    return (
      <div className="p-12 text-center">
        <p>No se pudo comprobar la sesión.</p>
        <Button onClick={() => void session.refetch()}>Reintentar</Button>
      </div>
    );
  if (session.data?.sesion?.rol !== "admin")
    return (
      <div className="mx-auto max-w-lg space-y-5 p-10 text-center">
        <ShieldCheck className="mx-auto size-12 text-navy" />
        <h1 className="text-2xl font-bold">Administración</h1>
        <p>Este espacio está reservado al equipo de gestión.</p>
        <Button asChild>
          <Link to="/acceso" search={{ destino: "admin" }}>
            Entrar como administrador
          </Link>
        </Button>
        <Link to="/" className="block underline">
          Volver a la tienda
        </Link>
      </div>
    );
  return (
    <ProveedorDolibarr>
      <ProveedorPedido>
        <div className="app-shell min-h-screen">
          <div className="flex flex-wrap justify-between gap-3 bg-navy px-5 py-2 text-xs text-white">
            <span>Administración · {session.data.sesion.nombre}</span>
            <div className="flex w-full items-center justify-between gap-5 sm:w-auto">
              <Link to="/">Ver tienda ↗</Link>
              <ConfirmarAccion
                variant="ghost"
                className="h-auto px-2 py-1 text-xs hover:bg-white/10 hover:text-white"
                titulo="¿Cerrar sesión?"
                descripcion="Saldrás de tu cuenta y se vaciará el carrito de este navegador. Tus pedidos y pagos registrados se conservarán."
                confirmar="Cerrar sesión"
                onConfirm={salir}
              >
                Cerrar sesión
              </ConfirmarAccion>
            </div>
          </div>
          <AsistenteChat
            key={`admin-${session.data.sesion.id}`}
            admin
            usuario={session.data.sesion}
          />
          <EncabezadoApp usuarioId={session.data.sesion.id} />
          <div className="flex">
            <BarraLateral />
            <main id="contenido-principal" tabIndex={-1} className="min-w-0 flex-1">
              {children}
            </main>
          </div>
        </div>
      </ProveedorPedido>
    </ProveedorDolibarr>
  );
}
function StoreShell({ children }: { children: ReactNode }) {
  const session = useSesion();
  const { canal, cambiarCanal, carrito } = useTienda();
  const user = session.data?.sesion;
  return (
    <div className="store-shell min-h-screen bg-[#faf8f4] text-[#20344e]">
      <div className="bg-[#20344e] px-5 py-2 text-center text-xs tracking-wide text-white/90">
        Para tu hogar. Para tu negocio. Siempre cerca.
      </div>
      <header className="sticky top-0 z-40 border-b border-[#e8e3da] bg-[#faf8f4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link
            to="/"
            className="store-brand text-3xl font-black italic tracking-tighter text-[#c52d36]"
          >
            BIMBO
            <span className="ml-2 align-middle text-[10px] font-semibold not-italic tracking-[.2em] text-[#20344e]">
              TIENDA
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Tienda">
            <Link to="/" className="hidden sm:block">
              Catálogo
            </Link>
            {user?.rol === "cliente" ? (
              <Link to="/mi-cuenta">Mi cuenta</Link>
            ) : (
              <Link to="/acceso" search={{ destino: user?.rol === "admin" ? "admin" : "cuenta" }}>
                {user?.rol === "admin" ? "Administración" : "Iniciar sesión"}
              </Link>
            )}
            {user?.rol === "cliente" && <NotificacionesCliente key={user.id} usuarioId={user.id} />}
            {user && (
              <ConfirmarAccion
                variant="ghost"
                size="icon"
                aria-label="Cerrar sesión"
                titulo="¿Cerrar sesión?"
                descripcion="Saldrás de tu cuenta y se vaciará el carrito de este navegador. Tus pedidos y pagos registrados se conservarán."
                confirmar="Cerrar sesión"
                onConfirm={salir}
              >
                <LogOut className="size-4" />
              </ConfirmarAccion>
            )}
            <Link
              to="/carrito"
              className="flex items-center gap-2 rounded-full bg-[#20344e] px-4 py-2.5 text-white"
            >
              <ShoppingBag className="size-4" />
              Carrito{" "}
              <span className="rounded-full bg-white/20 px-2 text-xs">
                {carrito.reduce((a, l) => a + l.cantidad, 0)}
              </span>
            </Link>
          </nav>
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 pb-3 lg:px-8">
          <div
            className="inline-flex rounded-full border border-[#d8d7d1] p-1"
            aria-label="Tipo de compra"
          >
            {(
              [
                ["b2c", "Para mi hogar", House],
                ["b2b", "Para mi negocio", Store],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => cambiarCanal(value)}
                disabled={user?.canal === "b2c" && value === "b2b"}
                title={
                  user?.canal === "b2c" && value === "b2b"
                    ? "La compra mayorista requiere una cuenta de negocio"
                    : undefined
                }
                aria-pressed={canal === value}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-40 ${canal === value ? "bg-[#20344e] text-white" : "text-[#20344e]"}`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {canal === "b2c"
              ? "Precios con impuestos incluidos"
              : "Precios para negocios sin impuestos · total al confirmar"}
          </span>
        </div>
      </header>
      <main id="contenido-principal" tabIndex={-1}>
        {children}
      </main>
      <AsistenteChat
        key={`tienda-${user?.id ?? "visitante"}-${canal}`}
        usuario={user ?? null}
        canal={canal}
        carrito={carrito}
      />
      <footer className="mt-16 border-t border-[#e8e3da] px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 text-xs text-slate-500">
          <span>
            Bimbo · Tienda para personas y negocios
            <br />
            <span className="text-[11px]">Siempre cerca de ti.</span>
          </span>
          <Link to="/admin" className="flex items-center gap-1">
            Acceso de administración <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
