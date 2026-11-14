import type { DatosDolibarr } from "./dolibarr-model";
import { facturasReporte, type FiltrosReporte } from "./report-details.ts";
import { sumarDinero } from "./reports-model.ts";

export function rankingClientesPorCanal(datos: DatosDolibarr, filtros: FiltrosReporte) {
  const facturas = facturasReporte(datos, filtros);
  return (["b2c", "b2b"] as const)
    .filter((canal) => filtros.canal === "todos" || filtros.canal === canal)
    .map((canal) => {
      const documentos = facturas.filter((f) => f.canal === canal);
      const clientes = new Map<
        number,
        { id: number; nombre: string; importes: number[]; compras: number }
      >();
      for (const f of documentos) {
        if (!f.clienteId) continue;
        const cliente = clientes.get(f.clienteId) ?? {
          id: f.clienteId,
          nombre: f.cliente,
          importes: [],
          compras: 0,
        };
        cliente.importes.push(f.subtotal);
        if (f.tipo !== 2 && f.subtotal > 0) cliente.compras += 1;
        clientes.set(f.clienteId, cliente);
      }
      const ranking = [...clientes.values()]
        .map((c) => ({
          id: c.id,
          nombre: c.nombre,
          compras: c.compras,
          ventas: sumarDinero(c.importes),
        }))
        .filter((c) => c.ventas > 0)
        .sort((a, b) => b.ventas - a.ventas || a.id - b.id);
      return {
        canal,
        clientesConVentas: ranking.length,
        sinCliente: documentos.filter((f) => !f.clienteId).length,
        ranking: ranking.slice(0, 10),
      };
    });
}
