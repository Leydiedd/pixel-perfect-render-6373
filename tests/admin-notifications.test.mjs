import test from "node:test";
import assert from "node:assert/strict";
import {
  textoAvisoAdmin,
  avisosAdminSchema,
  documentoNotificado,
} from "../src/lib/admin-notifications-model.ts";
const base = {
  id: 1,
  documentoId: 1442,
  referencia: "SO-1442",
  cliente: "Cliente curso",
  canal: "b2b",
  tipo: "pedido_cliente",
  importe: 118,
  moneda: "PEN",
  metodo: null,
  creadaEn: "2026-11-12T12:00:00Z",
  leida: false,
};
test("purchase notice identifies customer, B2B/B2C, document and native total", () => {
  const n = textoAvisoAdmin(base);
  assert.equal(n.titulo, "Nuevo pedido");
  assert.match(n.mensaje, /Cliente curso · B2B.*SO-1442.*118/);
  assert.match(textoAvisoAdmin({ ...base, canal: "b2c" }).mensaje, /B2C/);
});
test("payment notices preserve the method and use registered payment wording", () => {
  for (const [metodo, label] of [
    ["tarjeta", "Tarjeta"],
    ["yape", "Yape"],
    ["plin", "Plin"],
  ]) {
    const n = textoAvisoAdmin({ ...base, tipo: "pago_cliente", metodo, referencia: "IN-1442" });
    assert.equal(n.titulo, "Pago registrado");
    assert.ok(n.mensaje.includes(label));
    assert.match(n.mensaje, /IN-1442/);
  }
});
test("document links only accept positive safe integer IDs", () => {
  for (const x of [1, "1442"]) assert.equal(documentoNotificado(x), Number(x));
  for (const x of [null, undefined, {}, [], true, -1, "oops", 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(documentoNotificado(x), undefined);
});
test("admin inbox validates channel, amount and event type", () => {
  const p = { ok: true, notificaciones: [base], sinLeer: 1, ultimoId: 1, antes: null };
  assert.ok(avisosAdminSchema.safeParse(p).success);
  for (const patch of [{ canal: "unknown" }, { importe: NaN }, { tipo: "entregada" }])
    assert.ok(
      !avisosAdminSchema.safeParse({ ...p, notificaciones: [{ ...base, ...patch }] }).success,
    );
});
