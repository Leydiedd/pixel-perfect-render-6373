import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { formatoMoneda } from "@/data/catalogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { descargarArchivo, generarBoleta, leerBoletas, type BoletaGuardada } from "@/lib/boleta";

export const Route = createFileRoute("/boletas")({
  head: () => ({
    meta: [
      { title: "Historial de boletas — Bimbo Osito" },
      { name: "description", content: "Consulta y descarga en PDF las boletas de pago de tus pedidos mayoristas." },
      { property: "og:title", content: "Historial de boletas — Bimbo Osito" },
      { property: "og:description", content: "Boletas de pago de pedidos mayoristas descargables en PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Boletas,
});

function Boletas() {
  const [boletas, setBoletas] = useState<BoletaGuardada[]>([]);
  useEffect(() => setBoletas(leerBoletas()), []);

  const descargar = async (b: BoletaGuardada) => {
    const { blob, nombre } = await generarBoleta(b);
    descargarArchivo(blob, nombre);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Historial de boletas</h1>
      {boletas.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-background p-12 text-center">
          <p className="text-sm text-muted-foreground">Aún no tienes boletas de pago.</p>
          <Button asChild className="mt-5">
            <Link to="/pedido">Ir al pedido</Link>
          </Button>
        </div>
      ) : (
        <Card className="mt-8 overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-navy-soft text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Boleta</th>
                <th className="px-3 py-3 font-medium">Fecha</th>
                <th className="px-3 py-3 font-medium">Orden</th>
                <th className="px-3 py-3 font-medium">N.° operación</th>
                <th className="px-3 py-3 font-medium">Total</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {boletas.map((b) => (
                <tr key={`${b.ordenId}-${b.fecha}`}>
                  <td className="px-6 py-4 font-mono text-xs text-foreground">B001-{b.ordenId.slice(-6)}</td>
                  <td className="px-3 py-4 text-muted-foreground">{new Date(b.fecha).toLocaleString("es-PE")}</td>
                  <td className="px-3 py-4 text-muted-foreground">{b.ordenId}</td>
                  <td className="px-3 py-4 font-mono text-xs text-muted-foreground">{b.nroOperacion}</td>
                  <td className="px-3 py-4 font-medium text-foreground">{formatoMoneda(b.total)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => descargar(b)}>
                      <Download className="size-4" aria-hidden />
                      Descargar PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
