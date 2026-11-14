import test from "node:test";
import assert from "node:assert/strict";
import { nuevoPagoSchema, pagoCreadoSchema } from "../src/lib/payment-model.ts";
const payment = {
  solicitudId: "f1cd5432-abcd-4abc-8abc-001122334455",
  facturaId: 1,
  cuentaId: 1,
  medioId: 2,
  importe: 10.25,
  saldoEsperado: 23.36,
  fecha: "2026-11-12",
  referencia: "TR-123",
};
test("payments require exact positive amounts, destination and invoice; cannot exceed balance", () => {
  assert.equal(nuevoPagoSchema.safeParse(payment).success, true);
  for (const change of [
    { importe: 0 },
    { importe: -1 },
    { importe: 10.251 },
    { importe: Infinity },
    { importe: 24 },
    { saldoEsperado: 0 },
    { cuentaId: 0 },
    { facturaId: "1" },
    { referencia: "<script>" },
    { pagada: true },
  ])
    assert.equal(nuevoPagoSchema.safeParse({ ...payment, ...change }).success, false);
});
test("successful payment requires native payment and bank movement identifiers", () => {
  const result = {
    ok: true,
    repetido: false,
    aviso: null,
    pago: {
      id: 2,
      ref: "PAY-2",
      importe: 10.25,
      fecha: payment.fecha,
      movimientoId: 3,
      cuenta: "BCP",
    },
    factura: { id: 1, ref: "IN-1", estado: 1, pagada: false, saldo: 13.11 },
  };
  assert.equal(pagoCreadoSchema.safeParse(result).success, true);
  assert.equal(
    pagoCreadoSchema.safeParse({ ...result, pago: { ...result.pago, movimientoId: 0 } }).success,
    false,
  );
  assert.equal(
    pagoCreadoSchema.safeParse({ ...result, factura: { ...result.factura, saldo: -1 } }).success,
    false,
  );
});
