// The course presents every recorded payment together; native audit metadata stays intact.
export function nombrePago(value?: string | null) {
  return (value ?? "").replace(/\s*\(DEMO\)/gi, "").trim();
}
export function nombreCuenta(value?: string | null) {
  return value === "Pasarela DEMO - sin dinero" ? "Pagos de la tienda" : (value ?? "No registrada");
}
export function referenciaPago(value?: string | null) {
  return value?.replace(/^DEMO-/, "") || "Sin referencia";
}
export function agruparMetodos(pagos: { codigo: string; medio: string; importe: number }[]) {
  const groups = new Map<string, { codigo: string; medio: string; centavos: number }>();
  for (const p of pagos) {
    const group = groups.get(p.codigo) ?? {
      codigo: p.codigo,
      medio: nombrePago(p.medio),
      centavos: 0,
    };
    group.centavos += Math.round(p.importe * 100);
    groups.set(p.codigo, group);
  }
  return [...groups.values()].map((p) => ({
    codigo: p.codigo,
    medio: p.medio,
    importe: p.centavos / 100,
  }));
}
