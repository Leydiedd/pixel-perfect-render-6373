import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { alertas } from "@/data/operaciones";

export const Route = createFileRoute("/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas operativas — Bimbo Osito" },
      { name: "description", content: "Alertas de stock, caducidad de lotes y retrasos de rutas." },
      { property: "og:title", content: "Alertas operativas — Bimbo Osito" },
      { property: "og:description", content: "Incidencias de la cadena de suministro priorizadas por nivel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Alertas,
});

const tono = { "Crítica": "bg-primary/10 text-primary", Media: "bg-warning/15 text-warning", Baja: "bg-navy-soft text-navy" } as const;

function Alertas() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Alertas</h1>
      {alertas.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex items-start gap-4 p-4">
            <span className={`rounded-lg p-2 ${tono[a.nivel]}`}><AlertTriangle className="size-5" /></span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{a.titulo}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tono[a.nivel]}`}>{a.nivel}</span>
              </div>
              <p className="text-sm text-muted-foreground">{a.detalle}</p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{a.hora}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
