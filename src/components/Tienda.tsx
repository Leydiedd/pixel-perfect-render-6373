import { FichaProducto } from "./FichaProducto";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Wheat,
  Plus,
  ArrowRight,
  PackageCheck,
  ShoppingBag,
  Search,
  RefreshCw,
} from "lucide-react";
import { useCatalogo, useTienda, useSesion } from "@/context/tienda";
import { condicionMayorista, precioParaCompra } from "@/lib/store-model";
import { CondicionMayorista } from "./CondicionMayorista";
import { formatoMoneda } from "@/lib/dolibarr-model";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
export function Tienda() {
  const q = useCatalogo();
  const session = useSesion();
  const user = session.data?.sesion;
  const { canal, carrito, cantidad } = useTienda();
  const condicion = condicionMayorista(carrito, q.data);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Todos");
  const productos = [...(q.data?.productos || [])].sort(
    (a, b) => Number(b.comprable) - Number(a.comprable),
  );
  const categorias = [...new Set(productos.flatMap((p) => p.categorias))];
  const result = productos.filter(
    (p) =>
      (cat === "Todos" || p.categorias.includes(cat)) &&
      `${p.nombre} ${p.sku}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")),
  );
  return (
    <div className="mx-auto max-w-7xl px-5 lg:px-8">
      <section className="store-hero relative my-7 grid overflow-hidden rounded-[28px] bg-[#eee9df] md:grid-cols-[1.15fr_1fr]">
        <div className="relative z-10 px-7 py-10 md:px-12 md:py-14">
          <span className="mb-5 inline-block text-[10px] font-bold uppercase tracking-[.22em] text-[#a22e36]">
            {canal === "b2c" ? "Buenos momentos, todos los días" : "El aliado de tu negocio"}
          </span>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            {canal === "b2c" ? (
              <>
                Lo de siempre.
                <br />
                <span className="font-serif font-normal italic">Así de rico.</span>
              </>
            ) : (
              <>
                Tu próxima venta
                <br />
                <span className="font-serif font-normal italic">empieza aquí.</span>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600">
            {canal === "b2c"
              ? "Elige tus favoritos, arma tu carrito y haz tu pedido en un solo lugar."
              : "Encuentra productos para abastecer tu negocio y lleva el control de tus pedidos y facturas."}
          </p>
          <a
            href="#catalogo"
            className="mt-7 inline-flex items-center gap-4 rounded-full bg-[#c52d36] px-6 py-3 text-sm font-semibold text-white"
          >
            Explorar productos <ArrowRight className="size-4" />
          </a>
        </div>
        <div
          className="relative flex min-h-48 items-center justify-center bg-[#e4ddce] p-8"
          aria-hidden="true"
        >
          <div className="absolute size-64 rounded-full border border-white/50 md:size-80" />
          <div className="absolute size-52 rounded-full bg-[#f8f4ea] md:size-64" />
          <Wheat
            className="relative size-40 -rotate-12 text-[#b58b53] md:size-52"
            strokeWidth={0.8}
          />
          <div className="absolute bottom-7 right-7 rounded-2xl bg-[#20344e] p-4 text-white shadow-lg">
            <p className="text-[10px] uppercase tracking-widest">Hecho para</p>
            <p className="mt-1 font-serif text-2xl italic">compartir.</p>
          </div>
        </div>
      </section>
      <div className="mb-10 grid gap-4 border-y border-[#e8e3da] py-5 sm:grid-cols-3">
        {[
          [ShoppingBag, "Compra a tu medida", "Para tu hogar o tu negocio"],
          [PackageCheck, "Disponibilidad actualizada", "Revisamos el stock al confirmar"],
          [RefreshCw, "Tus pedidos, en un lugar", "Consulta tus facturas y su saldo"],
        ].map(([Icon, title, desc]) => {
          const I = Icon as typeof ShoppingBag;
          return (
            <div key={String(title)} className="flex items-center gap-3">
              <I className="size-6 text-[#a22e36]" strokeWidth={1.4} />
              <div>
                <p className="text-sm font-semibold">{String(title)}</p>
                <p className="text-xs text-slate-500">{String(desc)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <section id="catalogo" className="scroll-mt-44">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a22e36]">
              Nuestro catálogo
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Elige tus favoritos</h2>
            {q.data?.tarifa && (
              <p className="mt-2 text-sm text-slate-600">
                Tarifa {condicion.tarifa} ·{" "}
                {canal === "b2c" ? "impuestos incluidos" : "precios sin impuestos"}
              </p>
            )}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 size-4 text-slate-400" />
            <Input
              className="rounded-full bg-white pl-9"
              aria-label="Buscar productos"
              placeholder="Buscar pan, tortillas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="mb-7 flex flex-wrap gap-2">
          {["Todos", ...categorias].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-2 text-xs transition ${cat === c ? "border-[#20344e] bg-[#20344e] text-white" : "border-[#dedad2] bg-white hover:border-[#20344e]"}`}
            >
              {c}
            </button>
          ))}
        </div>
        {!q.isPending && !q.isError && (
          <CondicionMayorista condicion={condicion} moneda={q.data?.moneda} />
        )}
        {q.isPending ? (
          <p className="py-12 text-center">Cargando el catálogo…</p>
        ) : q.isError ? (
          <div role="alert" className="space-y-3 py-12 text-center">
            <p>No pudimos actualizar los productos.</p>
            <Button onClick={() => void q.refetch()}>Reintentar</Button>
          </div>
        ) : !result.length ? (
          <p className="py-12 text-center">No encontramos productos con esa búsqueda.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.map((p, i) => (
              <article
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-[#e8e3da] bg-white transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`relative grid h-36 place-content-center ${["bg-[#f1e9d8]", "bg-[#e9ece3]", "bg-[#f0e5df]", "bg-[#e6eaf0]"][i % 4]}`}
                >
                  {p.foto ? (
                    <img
                      src={p.foto}
                      alt={p.nombre}
                      loading="lazy"
                      className="h-32 w-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <Wheat className="mx-auto size-12 text-[#b5976b]/70" strokeWidth={1} />
                      <span className="text-[10px] text-slate-500">Foto por completar</span>
                    </div>
                  )}
                  <span className="absolute left-4 top-3 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                    {p.categorias[0] || "Bimbo"}
                  </span>
                  <span
                    className={`absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-1 text-[10px] ${p.comprable ? "text-green-800" : "text-slate-500"}`}
                  >
                    {p.comprable ? "Disponible" : "No disponible online"}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-[10px] text-slate-400">{p.sku}</p>
                  <h3 className="mt-1 min-h-12 text-base font-semibold leading-6">{p.nombre}</h3>
                  <p className="mt-2 line-clamp-2 min-h-8 text-xs leading-4 text-slate-500">
                    {p.descripcion ||
                      p.presentacion ||
                      "Información comercial pendiente de completar."}
                  </p>
                  <FichaProducto p={p} />
                  <div className="mt-5 flex items-end justify-between gap-2">
                    <div>
                      <strong className="text-xl">
                        {p.precio > 0
                          ? formatoMoneda(
                              canal === "b2c"
                                ? precioParaCompra(p, condicion).precioFinal
                                : precioParaCompra(p, condicion).precio,
                              q.data?.moneda,
                            )
                          : "Consultar"}
                      </strong>
                      <p className="text-[10px] text-slate-500">
                        {canal === "b2c" ? "Impuestos incluidos" : "Sin impuestos"} ·{" "}
                        {p.unidad || "unidad de venta"}
                      </p>
                      {condicion.aplica && !condicion.mayorista && p.precio > 0 && (
                        <p className="mt-1 text-xs text-slate-600">
                          Mayorista:{" "}
                          {formatoMoneda(
                            canal === "b2c" ? p.precioFinal : p.precio,
                            q.data?.moneda,
                          )}{" "}
                          al alcanzar el mínimo.
                        </p>
                      )}
                    </div>
                    <button
                      aria-label={`Añadir ${p.nombre}`}
                      disabled={
                        !p.comprable ||
                        (carrito.find((l) => l.id === p.id)?.cantidad || 0) >= p.disponible
                      }
                      onClick={() => {
                        cantidad(p.id, (carrito.find((l) => l.id === p.id)?.cantidad || 0) + 1);
                        toast.success(`${p.nombre} añadido al carrito`);
                      }}
                      className="grid size-10 shrink-0 place-content-center rounded-full bg-[#c52d36] text-white transition hover:bg-[#a22e36] disabled:bg-slate-200"
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {session.isSuccess && (
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#20344e] p-7 text-white">
          <div>
            <h2 className="text-lg font-semibold">Cada pedido tiene su lugar.</h2>
            <p className="mt-1 text-sm text-white/70">
              {user
                ? "Consulta tus pedidos, facturas y saldos cuando lo necesites."
                : "Crea tu cuenta y consulta tus pedidos y facturas cuando lo necesites."}
            </p>
          </div>
          <Link
            to={
              user?.rol === "cliente"
                ? "/mi-cuenta"
                : user?.rol === "admin"
                  ? "/admin"
                  : "/registro"
            }
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#20344e]"
          >
            {user?.rol === "cliente"
              ? "Ver mis pedidos y facturas →"
              : user?.rol === "admin"
                ? "Ir a administración →"
                : "Crear mi cuenta →"}
          </Link>
        </div>
      )}
    </div>
  );
}
