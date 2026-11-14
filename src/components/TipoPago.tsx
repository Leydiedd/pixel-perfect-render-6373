export function TipoPago({ demo }: { demo: boolean | null }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${demo === true ? "border-amber-300 bg-amber-50 text-amber-900" : demo === false ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}
    >
      {demo === true
        ? "Prueba · DEMO"
        : demo === false
          ? "Real · sin marca DEMO"
          : "Tipo no registrado"}
    </span>
  );
}
