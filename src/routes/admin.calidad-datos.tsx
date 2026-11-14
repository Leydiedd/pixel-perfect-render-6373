import { TablaAdaptable } from "@/components/TablaAdaptable";
import { actualizarConAviso } from "@/lib/ux-feedback";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsonApi, useSesion } from "@/context/tienda";
import { Pagina, EnDolibarr } from "@/components/DatosReales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Quality = {
  clientes: number;
  productos: number;
  consultadoEn: string;
  incidencias: {
    tipo: "cliente" | "producto";
    id: number;
    nombre: string;
    problema: string;
    nivel: string;
    ruta: string;
  }[];
};
export const Route = createFileRoute("/admin/calidad-datos")({ component: Calidad });
function Calidad() {
  const session = useSesion();
  const q = useQuery<Quality>({
    queryKey: ["calidad-datos", session.data?.sesion?.id],
    queryFn: () => jsonApi("/api/calidad-datos"),
    enabled: session.data?.sesion?.rol === "admin",
  });
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const issues = q.data?.incidencias || [];
  const shown = issues.filter(
    (i) =>
      (filter === "todos" || filter === i.tipo || filter === i.nivel) &&
      `${i.nombre} ${i.problema}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Pagina
      titulo="Calidad de datos"
      descripcion="Revisa y corrige la información de Dolibarr antes de usarla en reportes."
    >
      <div className="flex flex-wrap justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Las coincidencias son posibles duplicados: revísalos antes de unir clientes. La revisión
          de DNI/RUC comprueba formato, no validez ante SUNAT. Completa presentación y contenido en
          los atributos del producto, peso en su ficha y fotos en su sección de imágenes.
        </p>
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void actualizarConAviso(() => q.refetch())}
        >
          Actualizar revisión
        </Button>
      </div>
      {q.isPending ? (
        <p>Revisando clientes y productos…</p>
      ) : q.isError ? (
        <p role="alert">{q.error.message}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Clientes revisados", q.data?.clientes],
              ["Productos en venta", q.data?.productos],
              ["Registros con incidencias", new Set(issues.map((i) => `${i.tipo}-${i.id}`)).size],
            ].map(([t, n]) => (
              <div key={t} className="rounded-xl border bg-white p-5">
                <p className="text-sm text-slate-500">{t}</p>
                <p className="text-3xl font-bold">{n}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Input
              className="max-w-sm"
              aria-label="Buscar incidencias"
              placeholder="Cliente, producto o dato faltante"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(50);
              }}
            />
            <select
              aria-label="Tipo de incidencia"
              className="rounded border p-2"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(50);
              }}
            >
              <option value="todos">Todas las incidencias</option>
              <option value="duplicado">Posibles duplicados</option>
              <option value="cliente">Datos de clientes</option>
              <option value="producto">Fichas de productos</option>
            </select>
          </div>
          <p className="text-sm">
            {shown.length} incidencias · Revisión{" "}
            {new Date(q.data!.consultadoEn).toLocaleString("es-PE", { timeZone: "America/Lima" })}
          </p>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <TablaAdaptable className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Registro", "Problema detectado", "Acción"].map((t) => (
                    <th className="p-4" key={t}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((i, n) => (
                  <tr key={`${i.tipo}-${i.id}-${n}`} className="border-t">
                    <td className="p-4">
                      <strong>{i.nombre}</strong>
                      <p className="text-xs text-slate-500">
                        {i.tipo} #{i.id}
                      </p>
                    </td>
                    <td className="p-4">{i.problema}</td>
                    <td className="p-4">
                      <EnDolibarr ruta={i.ruta}>Revisar en Dolibarr</EnDolibarr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablaAdaptable>
            {!shown.length && (
              <p className="p-8 text-center">No hay incidencias con estos filtros.</p>
            )}
          </div>
          {shown.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 50)}>
              Mostrar más
            </Button>
          )}
        </>
      )}
    </Pagina>
  );
}
