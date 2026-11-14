import test from "node:test";
import assert from "node:assert/strict";
import { compraSchema } from "../src/lib/store-model.ts";
import { recojoSchema } from "../src/lib/pickup-model.ts";
import { estadoEntregaCliente } from "../src/lib/customer-delivery.ts";
import { textoAviso } from "../src/lib/notifications-model.ts";
const nonce = "a0cd5432-abcd-4abc-8abc-001122334455";
const order = {
  solicitudId: nonce,
  entrega: {
    contacto: "Persona prueba",
    telefono: "900000000",
    direccion: "",
    ciudad: "",
    tipo: "recojo",
  },
  lineas: [{ productoId: 1, cantidad: 1, precioEsperado: 10, impuestoEsperado: 18 }],
};
test("pickup needs contact but not delivery address; delivery still requires full address", () => {
  assert.ok(compraSchema.safeParse(order).success);
  for (const tipo of ["delivery", undefined])
    assert.equal(
      compraSchema.safeParse({ ...order, entrega: { ...order.entrega, tipo } }).success,
      false,
    );
  for (const patch of [
    { contacto: "" },
    { telefono: "" },
    { tipo: "invalid" },
    { puntoRecojo: "Injected address" },
  ])
    assert.equal(
      compraSchema.safeParse({ ...order, entrega: { ...order.entrega, ...patch } }).success,
      false,
    );
  const legacy = {
    ...order,
    entrega: {
      contacto: "Persona prueba",
      telefono: "900000000",
      direccion: "Calle ejemplo 123",
      ciudad: "Lima",
    },
  };
  assert.deepEqual(
    compraSchema.parse(legacy),
    legacy,
    "old pending payload is unchanged for idempotency",
  );
});
test("pickup actions reject actor overrides and require recipient/date only for collection", () => {
  const ready = { solicitudId: nonce, pedidoId: 1, accion: "listo" };
  assert.ok(recojoSchema.safeParse(ready).success);
  for (const patch of [{ usuarioId: 2 }, { fecha: "2026-11-12" }, { accion: "retiro" }])
    assert.equal(recojoSchema.safeParse({ ...ready, ...patch }).success, false);
  assert.ok(
    recojoSchema.safeParse({
      ...ready,
      accion: "retiro",
      fecha: "2026-11-12",
      receptor: "Persona prueba",
    }).success,
  );
});
test("customer pickup states do not become late delivery and cancellation has priority", () => {
  const p = { estado: 3, modalidad: "recojo", fechaPrevista: "2026-01-01" };
  assert.match(estadoEntregaCliente(p, "2026-11-12").titulo, /preparación/);
  assert.equal(
    estadoEntregaCliente({ ...p, listoRecojo: "2026-11-12" }, "2026-11-12").titulo,
    "Listo para recoger",
  );
  assert.equal(
    estadoEntregaCliente({ ...p, fechaEntregaReal: "2026-11-12" }, "2026-11-12").titulo,
    "Pedido retirado",
  );
  assert.equal(
    estadoEntregaCliente({ ...p, estado: -1, listoRecojo: "2026-11-12" }, "2026-11-12").titulo,
    "Pedido cancelado",
  );
});
test("pickup notifications identify preparation and collection", () => {
  const n = {
    id: 1,
    pedidoId: 1,
    pedidoRef: "SO-1",
    fecha: "2026-11-12",
    anterior: null,
    creadaEn: "2026-11-12T12:00:00Z",
    leida: false,
  };
  assert.equal(textoAviso({ ...n, tipo: "listo_recojo" }).titulo, "Listo para recoger");
  assert.match(textoAviso({ ...n, tipo: "retirado" }).mensaje, /retiro.*SO-1/);
});
