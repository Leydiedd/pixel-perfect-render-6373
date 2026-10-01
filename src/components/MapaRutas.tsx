import { centroDistribucion, rutas, type Ruta } from "@/data/operaciones";

const colorEstado: Record<Ruta["estado"], string> = {
  "En ruta": "var(--navy)",
  Cargando: "var(--warning)",
  Entregado: "var(--success)",
  Retraso: "var(--primary)",
};

export function MapaRutas({ alto = 320 }: { alto?: number }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40" style={{ height: alto }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {Array.from({ length: 9 }).map((_, i) => (
          <g key={i} stroke="var(--border)" strokeWidth="0.2">
            <line x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="100" />
            <line x1="0" y1={(i + 1) * 10} x2="100" y2={(i + 1) * 10} />
          </g>
        ))}
        <path d="M0 40 Q 20 45 30 30 T 60 20 T 100 25" stroke="var(--muted-foreground)" strokeOpacity="0.25" strokeWidth="1.2" fill="none" />
        <path d="M10 100 Q 40 70 30 30" stroke="var(--muted-foreground)" strokeOpacity="0.25" strokeWidth="1.2" fill="none" />
        {rutas.map((r) => (
          <line
            key={r.id}
            x1={centroDistribucion.x}
            y1={centroDistribucion.y}
            x2={r.x}
            y2={r.y}
            stroke={colorEstado[r.estado]}
            strokeWidth="0.5"
            strokeDasharray={r.estado === "Entregado" ? "0" : "1.5 1"}
            opacity="0.8"
          />
        ))}
      </svg>
      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        style={{ left: `${centroDistribucion.x}%`, top: `${centroDistribucion.y}%` }}
      >
        <span className="size-4 rounded-sm border-2 border-background bg-primary shadow" />
        <span className="mt-1 whitespace-nowrap rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold">CD Lima Norte</span>
      </div>
      {rutas.map((r) => (
        <div
          key={r.id}
          className="group absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${r.x}%`, top: `${r.y}%` }}
        >
          <span className="block size-3 rounded-full border-2 border-background shadow" style={{ background: colorEstado[r.estado] }} />
          <span className="pointer-events-none absolute left-4 top-0 z-10 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] shadow group-hover:block">
            <strong>{r.id}</strong> · {r.cadena} {r.destino} · {r.estado}
          </span>
        </div>
      ))}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-3 rounded-md bg-background/90 px-2 py-1 text-[11px]">
        {Object.entries(colorEstado).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: c }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

export { colorEstado };
