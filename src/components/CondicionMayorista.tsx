import type { condicionMayorista } from "@/lib/store-model";
import { formatoMoneda } from "@/lib/dolibarr-model";

export function CondicionMayorista({
  condicion,
  moneda,
}: {
  condicion: ReturnType<typeof condicionMayorista>;
  moneda?: string | undefined;
}) {
  if (!condicion.aplica || condicion.minimo <= 0) return null;
  return (
    <div
      role="status"
      className={`mb-5 rounded-xl border p-4 text-sm ${condicion.mayorista ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}
    >
      <p className="font-semibold">
        {condicion.mayorista
          ? "Precio mayorista aplicado a tu pedido"
          : "Tu pedido usa el precio normal"}
      </p>
      <p className="mt-1">
        {condicion.mayorista
          ? `Alcanzaste el mínimo mayorista de ${formatoMoneda(condicion.minimo, moneda)} sin IGV.`
          : `Te faltan ${formatoMoneda(condicion.faltante, moneda)} para acceder al precio mayorista.`}
      </p>
      <p className="mt-1 text-xs">
        Mínimo: {formatoMoneda(condicion.minimo, moneda)} sin IGV, sumando todos los productos a
        precio mayorista. Si no se alcanza, puedes comprar a precio normal.
      </p>
    </div>
  );
}
