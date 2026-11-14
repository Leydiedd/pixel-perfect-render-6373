export type PagoResumen = { codigo: string; medio: string; demostracion: boolean; importe: number };
export type FiltroPago = "todos" | "prueba" | "real" | "sin_pagos";
export function pagosCoincidentes(pagos: PagoResumen[], tipo: FiltroPago, metodo: string) {
  return pagos.filter(
    (p) =>
      (tipo === "todos" ||
        (tipo === "prueba" && p.demostracion) ||
        (tipo === "real" && !p.demostracion)) &&
      (metodo === "todos" || p.codigo === metodo),
  );
}
export function coincidePago(pagos: PagoResumen[], tipo: FiltroPago, metodo: string) {
  if (tipo === "sin_pagos") return pagos.length === 0 && metodo === "todos";
  if (tipo === "todos" && metodo === "todos") return true;
  return pagosCoincidentes(pagos, tipo, metodo).length > 0;
}
export function totalesPagos(pagos: PagoResumen[]) {
  const cents = pagos.reduce(
    (t, p) => {
      t[p.demostracion ? "prueba" : "real"] += Math.round(p.importe * 100);
      return t;
    },
    { prueba: 0, real: 0 },
  );
  return { prueba: cents.prueba / 100, real: cents.real / 100 };
}
