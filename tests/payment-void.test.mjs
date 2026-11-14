import test from "node:test";
import assert from "node:assert/strict";
import { anularPagoSchema, pagoAnuladoSchema } from "../src/lib/payment-void-model.ts";
test("payment void binds a payment, invoice and observed fingerprint to a reason", () => {
  const input = {
    solicitudId: "f1cd5432-abcd-4abc-8abc-001122334455",
    facturaId: 1,
    pagoId: 2,
    huella: "a".repeat(64),
    saldoEsperado: 0,
    motivo: "Cobro duplicado",
  };
  assert.equal(anularPagoSchema.safeParse(input).success, true);
  for (const change of [
    { pagoId: 0 },
    { facturaId: "1" },
    { huella: "fake" },
    { saldoEsperado: -1 },
    { motivo: "" },
    { motivo: "<script>" },
    { importe: 999 },
  ])
    assert.equal(anularPagoSchema.safeParse({ ...input, ...change }).success, false);
});
test("payment void result requires nonnegative remaining balance", () => {
  const result = {
    ok: true,
    repetido: false,
    pago: { id: 2, ref: "PAY-2", importe: 10, cuenta: "BCP" },
    factura: { id: 1, ref: "IN-1", saldo: 10, pagada: false, estado: 1 },
    aviso: null,
  };
  assert.equal(pagoAnuladoSchema.safeParse(result).success, true);
  assert.equal(
    pagoAnuladoSchema.safeParse({ ...result, factura: { ...result.factura, saldo: -1 } }).success,
    false,
  );
});
