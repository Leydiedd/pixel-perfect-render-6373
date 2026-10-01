import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { servicios } from "@/data/operaciones";

export const Route = createFileRoute("/estatus")({
  head: () => ({
    meta: [
      { title: "Estatus del sistema — Bimbo Osito" },
      { name: "description", content: "Estado operativo de planta, almacén, flota y facturación." },
      { property: "og:title", content: "Estatus del sistema — Bimbo Osito" },
      { property: "og:description", content: "Disponibilidad de los servicios de la cadena de suministro Bimbo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Estatus,
});

function Estatus() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Estatus</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Servicios operativos</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border">
          {servicios.map((s) => (
            <div key={s.nombre} className="flex items-center justify-between py-3 text-sm">
              <span className="font-medium">{s.nombre}</span>
              <span className="flex items-center gap-4">
                <span className="tabular-nums text-muted-foreground">{s.uptime}</span>
                <span className={`flex items-center gap-1.5 font-semibold ${s.estado === "Operativo" ? "text-success" : "text-warning"}`}>
                  <span className={`size-2 rounded-full ${s.estado === "Operativo" ? "bg-success" : "bg-warning"}`} />
                  {s.estado}
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
