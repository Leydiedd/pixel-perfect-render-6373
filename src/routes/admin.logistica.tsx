import { TablaAdaptable } from "@/components/TablaAdaptable";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import { Pagina, Vacio, Paginacion, Estado, EnDolibarr } from "@/components/DatosReales";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { estadoExpedicion, formatoFecha, pagina } from "@/lib/dolibarr-model";
export const Route = createFileRoute("/admin/logistica")({
  head: () => ({ meta: [{ title: "Expediciones y almacenes — Bimbo" }] }),
  component: Logistica,
});
function Logistica() {
  const { datos } = useDolibarr();
  const [consulta, setConsulta] = useState("");
  const [numero, setNumero] = useState(1);
  const result = datos.expediciones.filter((e) =>
    `${e.ref} ${e.cliente} ${e.destino ?? ""}`
      .toLowerCase()
      .includes(consulta.toLowerCase().trim()),
  );
  const page = pagina(result, numero);
  return (
    <Pagina titulo="Logística" descripcion="Almacenes y expediciones registrados en Dolibarr.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {datos.almacenes.map((a) => (
          <Card key={a.id} className="gap-2 p-4">
            <h2 className="font-semibold">{a.nombre}</h2>
            <p className="text-xs text-muted-foreground">
              {a.direccion || "Dirección no registrada"}
            </p>
            <p className="text-sm">
              {a.referencias} referencias con registro de stock ·{" "}
              {a.abierto ? "Abierto" : "Cerrado"}
            </p>
          </Card>
        ))}
      </div>
      <p className="rounded-lg bg-navy-soft p-4 text-sm">
        Las expediciones registran la salida de almacén. Confirma la recepción del cliente desde
        Pedidos; la fecha real queda separada de la fecha prevista.
      </p>
      <h2 className="text-lg font-semibold">
        Expediciones · {datos.expediciones.length.toLocaleString("es-PE")}
      </h2>
      <Input
        aria-label="Buscar expediciones"
        placeholder="Buscar referencia, cliente o destino"
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value);
          setNumero(1);
        }}
      />
      {!result.length ? (
        <Vacio>No hay expediciones que coincidan con la búsqueda.</Vacio>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <TablaAdaptable className="w-full text-left text-sm">
              <thead className="bg-navy-soft text-xs">
                <tr>
                  {[
                    "Expedición",
                    "Cliente",
                    "Destino",
                    "Fecha de expedición",
                    "Entrega prevista",
                    "Estado",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.items.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <EnDolibarr ruta={`expedition/card.php?id=${e.id}`}>{e.ref}</EnDolibarr>
                    </td>
                    <td className="px-4 py-3">{e.cliente}</td>
                    <td className="px-4 py-3">{e.destino || "No registrado"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatoFecha(e.fecha)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatoFecha(e.entrega)}</td>
                    <td className="px-4 py-3">
                      <Estado>{estadoExpedicion(e.estado)}</Estado>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablaAdaptable>
          </div>
          <Paginacion {...page} cambiar={setNumero} />
        </Card>
      )}
    </Pagina>
  );
}
