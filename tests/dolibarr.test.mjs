import test from "node:test";
import assert from "node:assert/strict";
import {
  estadoFactura,
  estadoPedido,
  estadoExpedicion,
  filtrarFacturas,
  pagina,
  alertasReales,
  datosSchema,
} from "../src/lib/dolibarr-model.ts";

const factura = {
  id: 1,
  ref: "IN-001",
  cliente: "Cliente Lima",
  tipo: 0,
  fecha: "2026-01-10",
  vencimiento: null,
  pagada: true,
  estado: 2,
  subtotal: 100,
  impuesto: 18,
  total: 118,
  pdf: true,
};
test("paid, draft and unpaid closed invoices remain distinct", () => {
  assert.equal(estadoFactura(factura), "Pagada");
  assert.equal(estadoFactura({ estado: 2, pagada: false }), "Cerrada");
  assert.equal(estadoFactura({ estado: 0, pagada: false }), "Borrador");
  assert.equal(estadoPedido(3), "Cerrado");
  assert.equal(estadoExpedicion(1), "Validada");
});
test("invoice filters combine customer, status and inclusive date bounds", () => {
  const rows = [
    factura,
    { ...factura, id: 2, ref: "IN-002", pagada: false, estado: 1, fecha: "2026-02-01" },
  ];
  assert.deepEqual(filtrarFacturas(rows, "lima", "Pagada", "2026-01-10", "2026-01-10"), [factura]);
  assert.equal(filtrarFacturas(rows, "missing").length, 0);
  assert.equal(filtrarFacturas(rows, "", "Pendiente").length, 1);
});
test("pagination includes final records and clamps stale page numbers", () => {
  const records = Array.from({ length: 1440 }, (_, i) => i);
  const result = pagina(records, 99);
  assert.equal(result.actual, 58);
  assert.equal(result.items.length, 15);
  assert.equal(result.items.at(-1), 1439);
  assert.equal(pagina([], 5).actual, 1);
});
test("alerts never invent low-stock thresholds or expiration dates", () => {
  const p = { id: 1, sku: "P", nombre: "Pan", stock: 10, umbral: 0, lotes: [] };
  assert.equal(alertasReales([p], "2026-11-12").length, 0);
  assert.equal(alertasReales([{ ...p, umbral: 10 }], "2026-11-12").length, 1);
  assert.equal(
    alertasReales(
      [{ ...p, lotes: [{ lote: "A", cantidad: 0, caducidad: "2025-01-01", almacen: "Lima" }] }],
      "2026-11-12",
    ).length,
    0,
  );
  assert.equal(alertasReales([{ ...p, stock: -1 }], "2026-11-12").length, 1);
});
test("malformed responses are rejected instead of presenting fake zero counts", () => {
  assert.equal(datosSchema.safeParse({ productos: [], facturas: [] }).success, false);
});
