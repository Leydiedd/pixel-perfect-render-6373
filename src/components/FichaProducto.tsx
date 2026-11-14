import type { ProductoTienda } from "@/lib/store-model";
export function FichaProducto({ p }: { p: ProductoTienda }) {
  return (
    <dl className="mt-3 space-y-1 border-t pt-3 text-xs text-slate-600">
      {[
        ["Presentación", p.presentacion],
        ["Peso", p.peso],
        [
          "Contenido",
          p.tipoEnvase && p.unidadesEnvase
            ? `${p.unidadesEnvase} unidades por ${p.tipoEnvase}`
            : null,
        ],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt>{label}</dt>
          <dd className="text-right font-medium">{value || "Por completar"}</dd>
        </div>
      ))}
    </dl>
  );
}
