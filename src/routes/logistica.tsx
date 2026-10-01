import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapaRutas, colorEstado } from "@/components/MapaRutas";
import { rutas } from "@/data/operaciones";

export const Route = createFileRoute("/logistica")({
  head: () => ({
    meta: [
      { title: "Logística y rutas — Bimbo Osito" },
      { name: "description", content: "Mapa de distribución y rutas de despacho activas hacia cadenas de supermercados." },
      { property: "og:title", content: "Logística y rutas — Bimbo Osito" },
      { property: "og:description", content: "Seguimiento de rutas de despacho Bimbo en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Logistica,
});

function Logistica() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Logística</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Mapa de distribución · Lima Metropolitana</CardTitle></CardHeader>
        <CardContent><MapaRutas alto={440} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Rutas de despacho</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Ruta</TableHead><TableHead>Cadena</TableHead><TableHead>Destino</TableHead><TableHead>Estado</TableHead><TableHead>Avance</TableHead><TableHead className="text-right">ETA</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rutas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.id}</TableCell>
                  <TableCell>{r.cadena}</TableCell>
                  <TableCell>{r.destino}</TableCell>
                  <TableCell><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: colorEstado[r.estado] }} />{r.estado}</span></TableCell>
                  <TableCell className="w-40"><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${r.avance}%` }} /></div></TableCell>
                  <TableCell className="text-right tabular-nums">{r.eta}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
