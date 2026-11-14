import { ComentarioReporte } from "@/components/ComentarioReporte";
import { TablaAdaptable } from "@/components/TablaAdaptable";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EnDolibarr, Paginacion, Vacio } from "@/components/DatosReales";
import { formatoFecha, pagina } from "@/lib/dolibarr-model";
import { cumplimientoEntrega, etiquetasCumplimiento } from "@/lib/reports-model";
type Pedido = {
  id: number;
  ref: string;
  cliente: string;
  estado: number;
  entrega: string | null;
  fechaEntregaReal: string | null;
};
export function ReporteEntregas({ pedidos, hoy }: { pedidos: Pedido[]; hoy: string }) {
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [numero, setNumero] = useState(1);
  const rows = pedidos
    .filter((p) => [1, 2, 3].includes(p.estado))
    .map((p) => ({ ...p, cumplimiento: cumplimientoEntrega(p, hoy) }))
    .filter(
      (p) =>
        (filtro === "todos" || p.cumplimiento.estado === filtro) &&
        `${p.ref} ${p.cliente}`.toLowerCase().includes(busqueda.toLowerCase().trim()),
    );
  const page = pagina(rows, numero);
  return (
    <Card className="gap-4 p-4">
      <h2 className="font-semibold">Cumplimiento por pedido</h2>
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          aria-label="Buscar entrega"
          placeholder="Pedido o cliente"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setNumero(1);
          }}
        />
        <select
          aria-label="Cumplimiento de entrega"
          className="rounded-md border bg-background px-3 text-sm"
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value);
            setNumero(1);
          }}
        >
          <option value="todos">Todos los pedidos vigentes</option>
          {Object.entries(etiquetasCumplimiento)
            .filter(([k]) => k !== "no_aplica")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </div>
      {rows.length ? (
        <>
          <div className="overflow-x-auto">
            <TablaAdaptable className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Pedido",
                    "Cliente",
                    "Fecha prevista",
                    "Fecha real",
                    "Cumplimiento",
                    "Días de retraso",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.items.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3">
                      <EnDolibarr ruta={`commande/card.php?id=${p.id}`}>{p.ref}</EnDolibarr>
                    </td>
                    <td className="p-3">{p.cliente}</td>
                    <td className="whitespace-nowrap p-3">{formatoFecha(p.entrega)}</td>
                    <td className="whitespace-nowrap p-3">{formatoFecha(p.fechaEntregaReal)}</td>
                    <td
                      className={`p-3 font-medium ${p.cumplimiento.estado === "a_tiempo" ? "text-emerald-700" : ["con_retraso", "vencido"].includes(p.cumplimiento.estado) ? "text-red-700" : "text-muted-foreground"}`}
                    >
                      {etiquetasCumplimiento[p.cumplimiento.estado]}
                    </td>
                    <td className="p-3">
                      {p.cumplimiento.diasRetraso ?? "—"}
                      {p.cumplimiento.estado === "vencido" ? " sin confirmar" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablaAdaptable>
          </div>
          <Paginacion {...page} cambiar={setNumero} />
        </>
      ) : (
        <Vacio>No hay pedidos con este cumplimiento en la selección.</Vacio>
      )}
      <ComentarioReporte
        titulo={"Cumplimiento por pedido"}
        datos={{
          pedidos: rows.length,
          estados: Object.entries(etiquetasCumplimiento).map(([estado, etiqueta]) => ({
            estado: etiqueta,
            cantidad: rows.filter((p) => p.cumplimiento.estado === estado).length,
          })),
        }}
        nota={`Selección actual de entregas, filtro ${filtro}, búsqueda ${busqueda || "ninguna"}. Pendientes vencidos no equivalen a entregados tarde. Fecha de referencia ${hoy}.`}
      />
    </Card>
  );
}
