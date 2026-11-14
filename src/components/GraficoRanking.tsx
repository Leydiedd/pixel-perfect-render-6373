import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatoMoneda } from "@/lib/dolibarr-model";

export type DatoRanking = { id: string; nombre: string; importe: number; detalle: string };
const compacto = (n: number) =>
  new Intl.NumberFormat("es-PE", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function GraficoRanking({
  datos,
  moneda,
  color,
  titulo,
}: {
  datos: DatoRanking[];
  moneda: string;
  color: string;
  titulo: string;
}) {
  const [ancho, setAncho] = useState(600);
  const estrecho = ancho < 430;
  const limite = estrecho ? 16 : 24;
  const etiquetas = new Map(datos.map((d) => [d.id, d.nombre]));
  return (
    <div className="min-w-0">
      <div
        className="w-full min-w-0"
        style={{ height: Math.max(260, datos.length * 44 + 52) }}
        role="group"
        aria-label={titulo}
      >
        <ResponsiveContainer width="100%" height="100%" onResize={(w) => setAncho(w)}>
          <BarChart
            data={datos}
            layout="vertical"
            margin={{ top: 8, right: estrecho ? 48 : 65, bottom: 18, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, "auto"]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickCount={estrecho ? 3 : 4}
              tickFormatter={compacto}
              label={{
                value: moneda === "PEN" ? "Importe sin IGV · S/" : `Importe sin IGV · ${moneda}`,
                position: "bottom",
                offset: 3,
                fontSize: 11,
                fill: "#64748b",
              }}
            />
            <YAxis
              type="category"
              dataKey="id"
              width={estrecho ? 108 : 155}
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={({ x, y, payload }) => {
                const nombre = etiquetas.get(String(payload.value)) ?? "";
                const palabras = nombre.split(" ");
                const lineas: string[] = [""];
                for (const palabra of palabras) {
                  const i = lineas.length - 1;
                  if ((lineas[i] + " " + palabra).trim().length > limite && lineas[i])
                    lineas.push(palabra);
                  else lineas[i] = (lineas[i] + " " + palabra).trim();
                }
                const visibles = lineas
                  .slice(0, 2)
                  .map((l) => (l.length > limite ? l.slice(0, limite - 1) + "…" : l));
                if (lineas.length > 2) visibles[1] = (visibles[1] ?? "").slice(0, limite - 1) + "…";
                return (
                  <g transform={`translate(${x},${y})`}>
                    <title>{nombre}</title>
                    <text textAnchor="end" fill="#334155" fontSize={estrecho ? 10 : 11}>
                      {visibles.map((linea, i) => (
                        <tspan key={i} x={-6} dy={i === 0 ? (visibles.length === 1 ? 4 : -3) : 13}>
                          {linea}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              }}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9", radius: 4 }}
              content={({ active, payload }) => {
                const fila = payload?.[0]?.payload as DatoRanking | undefined;
                if (!active || !fila) return null;
                return (
                  <div className="max-w-[240px] rounded-lg border bg-white p-3 text-sm shadow-lg">
                    <p className="break-words font-semibold text-slate-900">{fila.nombre}</p>
                    <p className="mt-1 text-xs text-slate-500">{fila.detalle}</p>
                    <p className="mt-2 font-bold" style={{ color }}>
                      {formatoMoneda(fila.importe, moneda)}{" "}
                      <span className="font-normal text-slate-500">sin IGV</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="importe"
              name="Importe sin IGV"
              barSize={22}
              radius={[0, 5, 5, 0]}
              isAnimationActive={false}
            >
              {datos.map((d, i) => (
                <Cell key={d.id} fill={color} fillOpacity={i === 0 ? 1 : 0.72} />
              ))}
              <LabelList
                dataKey="importe"
                position="right"
                formatter={(v: unknown) => compacto(Number(v))}
                fontSize={10}
                fill="#334155"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Toca una barra o pasa el cursor para ver el nombre y el importe exacto. La barra más intensa
        identifica al líder.
      </p>
      <ol className="sr-only">
        {datos.map((d) => (
          <li key={d.id}>
            {d.nombre}: {formatoMoneda(d.importe, moneda)} sin IGV. {d.detalle}
          </li>
        ))}
      </ol>
    </div>
  );
}
