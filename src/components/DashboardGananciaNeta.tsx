import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card } from "./ui/card";
import { Metrica, Dinero, Vacio, EnDolibarr } from "./DatosReales";
import { ComentarioReporte } from "./ComentarioReporte";
import { formatoMoneda } from "@/lib/dolibarr-model";
import { resumenNeto, notaNeta, type MesNeto } from "@/lib/net-profit";
export function DashboardGananciaNeta({ rows }: { rows: MesNeto[] }) {
  const r = resumenNeto(rows);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          titulo="Ventas sin IGV"
          valor={<Dinero valor={r.ventas} />}
          detalle="Meses con gastos clasificados"
        />
        <Metrica
          titulo="Margen bruto"
          valor={<Dinero valor={r.bruto} />}
          detalle="Ventas menos costo de productos vendidos"
        />
        <Metrica
          titulo="Gastos y provisiones"
          valor={<Dinero valor={r.gastos} />}
          detalle="Operación, depreciación, intereses y renta"
        />
        <Metrica
          titulo="Ganancia neta estimada"
          valor={r.meses ? <Dinero valor={r.neta} /> : "Sin datos suficientes"}
          detalle={`${r.meses} meses calculados${r.incompletos ? ` · ${r.incompletos} incompletos excluidos` : ""}`}
        />
      </div>
      <Card className="min-w-0 p-4 sm:p-6">
        <h2 className="font-semibold">Ganancia neta mensual</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Azul: ganancia. Rojo: pérdida. Mes actual provisional, según el corte de gastos.
        </p>
        {rows.length ? (
          <div className="mt-5 h-80 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ left: 8, right: 12, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                <YAxis
                  width={70}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(n) =>
                    new Intl.NumberFormat("es-PE", { notation: "compact" }).format(n)
                  }
                />
                <ReferenceLine y={0} stroke="#64748b" />
                <Tooltip formatter={(v) => formatoMoneda(Number(v))} />
                <Bar name="Ganancia neta" dataKey="neta" radius={[4, 4, 0, 0]}>
                  {rows.map((m) => (
                    <Cell key={m.mes} fill={(m.neta ?? 0) < 0 ? "#d51024" : "#20344e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Vacio>Sin meses para esta selección.</Vacio>
        )}
        <ComentarioReporte titulo="Ganancia neta mensual" datos={rows} nota={notaNeta} />
      </Card>
      <details className="rounded-xl border bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Cómo se calcula y dónde están los gastos
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>{notaNeta}</p>
          <p>
            Se reutilizan las facturas de logística, alquiler, publicidad y servicios generales; la
            nómina identificada como bimbo01–08 se clasifica como administrativa/comercial. Los
            servicios industriales y bimbo09–20 se consideran incluidos en el costo vendido. Estas
            clasificaciones son supuestos del proyecto.
          </p>
          <p>
            Se añadieron beneficios administrativos (20% de nómina), depreciación de activos
            administrativos/distribución (S/ 480 000 en 60 meses), intereses de un préstamo supuesto
            y provisión de renta (29,5% del resultado acumulado positivo del año). Las reversiones
            pueden aparecer negativas. Noviembre incluye gastos devengados hasta el 13/11; los meses
            sin cobertura suficiente no muestran ganancia neta.
          </p>
          <p>
            El histórico empieza en noviembre de 2024; ese año no representa doce meses. Las
            estimaciones no incluyen ajustes tributarios ni pérdidas de años anteriores.
          </p>
          <EnDolibarr ruta="accountancy/bookkeeping/list.php">
            Ver asientos en Dolibarr · diario BIMBO
          </EnDolibarr>
        </div>
      </details>
    </>
  );
}
