import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, PackageOpen, Route as RutaIcono } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapaRutas } from "@/components/MapaRutas";
import { ProductoImagen } from "@/components/ProductoImagen";
import { canales, entregasSemanales, kpis, rutas } from "@/data/operaciones";
import { productos, formatoMoneda } from "@/data/catalogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel de Control — Bimbo Osito" },
      { name: "description", content: "Dashboard gerencial de cadena de suministro y logística Bimbo para supermercados." },
      { property: "og:title", content: "Panel de Control — Bimbo Osito" },
      { property: "og:description", content: "KPIs de pedidos, rutas de despacho y alertas de stock en un solo panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Panel,
});

const coloresCanal = ["var(--primary)", "var(--navy)", "var(--chart-3)", "var(--chart-4)"];

function Kpi({ titulo, valor, icono: Icono, tono }: { titulo: string; valor: number; icono: typeof Clock; tono: string }) {
  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{valor}</p>
        </div>
        <span className={`rounded-lg p-3 ${tono}`}><Icono className="size-5" /></span>
      </CardContent>
    </Card>
  );
}

function Panel() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel de Control</h1>
        <p className="text-sm text-muted-foreground">Cadena de suministro · CD Lima Norte</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi titulo="Pedidos activos" valor={kpis.pedidosActivos} icono={PackageOpen} tono="bg-navy-soft text-navy" />
        <Kpi titulo="Entregados hoy" valor={kpis.entregadosHoy} icono={CheckCircle2} tono="bg-success/15 text-success" />
        <Kpi titulo="Pendientes" valor={kpis.pendientes} icono={Clock} tono="bg-warning/15 text-warning" />
        <Kpi titulo="Rutas activas" valor={kpis.rutasActivas} icono={RutaIcono} tono="bg-navy-soft text-navy" />
        <Kpi titulo="Alertas de stock" valor={kpis.alertasStock} icono={AlertTriangle} tono="bg-primary/10 text-primary" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Rutas de despacho activas</CardTitle>
            <Link to="/logistica" className="text-sm font-medium text-primary hover:underline">Ver logística</Link>
          </CardHeader>
          <CardContent><MapaRutas /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Canales de distribución</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={canales} dataKey="valor" nameKey="canal" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {canales.map((c, i) => <Cell key={c.canal} fill={coloresCanal[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {canales.map((c, i) => (
                <li key={c.canal} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: coloresCanal[i] }} />{c.canal}</span>
                  <strong className="tabular-nums">{c.valor}%</strong>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="text-base">Entregas semanales</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={entregasSemanales}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="programadas" name="Programadas" fill="var(--navy-soft)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="entregas" name="Entregadas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Estado de rutas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {rutas.slice(0, 5).map((r) => (
              <div key={r.id}>
                <div className="flex justify-between text-sm"><span className="font-medium">{r.id} · {r.cadena} {r.destino}</span><span className="text-muted-foreground">{r.estado}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${r.avance}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Inventario mayorista</CardTitle>
          <Link to="/inventario" className="text-sm font-medium text-primary hover:underline">Ver inventario</Link>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {productos.map((p) => (
            <Link key={p.sku} to="/producto/$sku" params={{ sku: p.sku }} className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-card-hover">
              <div className="aspect-[4/3] overflow-hidden bg-background">
                <ProductoImagen src={p.imagenes[0]} alt={p.nombre} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="space-y-1 p-3">
                <p className="text-xs text-muted-foreground">{p.sku}</p>
                <p className="text-sm font-semibold leading-tight">{p.nombre}</p>
                <div className="flex justify-between text-xs">
                  <span className={p.stockPlanchas < 200 ? "font-semibold text-primary" : "text-muted-foreground"}>{p.stockPlanchas} planchas</span>
                  <span className="font-semibold">{formatoMoneda(p.precios[0]?.precio ?? 0)}</span>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
