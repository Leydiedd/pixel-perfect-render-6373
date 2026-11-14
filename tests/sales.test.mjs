import test from "node:test";
import assert from "node:assert/strict";
import { resumenVentas, coincideCanal } from "../src/lib/sales-model.ts";
const f = {
  id: 1,
  ref: "F1",
  cliente: "Cliente",
  tipo: 0,
  fecha: "2026-11-01",
  estado: 1,
  subtotal: 100,
  canal: "b2b",
  fuenteCanal: "documento",
};
test("channel subtotals reconcile, credit notes retain their sign, non-sales are excluded", () => {
  const rows = [
    f,
    { ...f, id: 2, canal: "b2c", subtotal: 50 },
    { ...f, id: 3, canal: "b2c", tipo: 2, subtotal: -10 },
    { ...f, id: 4, canal: null, subtotal: 20 },
    ...[0, 3].map((estado) => ({ ...f, estado, subtotal: 999 })),
    { ...f, tipo: 4, subtotal: 999 },
  ];
  const r = resumenVentas(rows);
  assert.equal(r.total, 160);
  assert.deepEqual(
    r.grupos.map((g) => g.importe),
    [100, 40, 20],
  );
  assert.equal(
    r.grupos.reduce((s, g) => s + g.importe, 0),
    r.total,
  );
  assert.equal(r.seleccion.length, 4);
  assert.deepEqual(r.meses, [{ mes: "2026-11", b2b: 100, b2c: 40, sin_clasificar: 20 }]);
});
test("channel/date filters are inclusive and empty B2C does not fabricate sales", () => {
  assert.equal(resumenVentas([f], "2026-11-01", "2026-11-01", "b2b").total, 100);
  assert.equal(resumenVentas([f], "2026-11-02").total, 0);
  const r = resumenVentas([f], "", "", "b2c");
  assert.equal(r.total, 0);
  assert.equal(r.seleccion.length, 0);
  assert.equal(r.meses.length, 0);
  assert.equal(coincideCanal(null, "sin_clasificar"), true);
  assert.equal(coincideCanal("b2b", "b2c"), false);
});
test("inferred history, undated invoices and decimal amounts remain explicit", () => {
  const r = resumenVentas([
    { ...f, subtotal: 0.1, fuenteCanal: "cliente" },
    { ...f, subtotal: 0.2, fecha: null },
  ]);
  assert.equal(r.total, 0.3);
  assert.equal(r.segunCliente, 1);
  assert.equal(r.sinFecha, 1);
  assert.equal(r.meses[0].b2b, 0.1);
  assert.equal(resumenVentas([{ ...f, fecha: null }], "2026-01-01").total, 0);
});
