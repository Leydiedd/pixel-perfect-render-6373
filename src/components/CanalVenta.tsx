import { canalesVenta, type FiltroCanal } from "@/lib/sales-model";

export function CanalVenta({
  canal,
  fuenteCanal,
}: {
  canal?: "b2b" | "b2c" | null;
  fuenteCanal?: string;
}) {
  const source =
    fuenteCanal === "reconstruido"
      ? "Clasificación histórica reconstruida"
      : fuenteCanal === "cliente"
        ? "Según cliente actual"
        : fuenteCanal === "vinculado"
          ? "Documento vinculado"
          : fuenteCanal === "conflicto"
            ? "Canales vinculados distintos"
            : !canal
              ? "Sin información suficiente"
              : "Registrado en la venta";
  return (
    <span className="inline-flex flex-col gap-1" title={source}>
      <span
        className={`w-fit whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${canal === "b2b" ? "bg-blue-100 text-blue-900" : canal === "b2c" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}
      >
        {canal === "b2b" ? "B2B · Negocio" : canal === "b2c" ? "B2C · Hogar" : "Sin clasificar"}
      </span>
      {fuenteCanal !== "documento" && (
        <span className="text-[10px] text-muted-foreground">{source}</span>
      )}
    </span>
  );
}
export function FiltroCanalVenta({
  value,
  onChange,
}: {
  value: FiltroCanal;
  onChange: (value: FiltroCanal) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      Canal de venta
      <select
        aria-label="Canal de venta"
        value={value}
        onChange={(e) => onChange(e.target.value as FiltroCanal)}
        className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
      >
        {canalesVenta.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
