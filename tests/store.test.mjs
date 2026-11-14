import test from "node:test";
import assert from "node:assert/strict";
import {
  registroSchema,
  compraSchema,
  origenLocal,
  lineasCarrito,
  condicionMayorista,
} from "../src/lib/store-model.ts";
const profile = {
  canal: "b2c",
  nombre: "Cliente de prueba",
  contacto: "Cliente Prueba",
  documento: "99887766",
  correo: "persona@example.test",
  telefono: "999888777",
  direccion: "Direccion de prueba 123",
  ciudad: "Lima",
  password: "UnaClaveDePrueba!",
};
const order = {
  solicitudId: "a0cd5432-abcd-4abc-8abc-001122334455",
  entrega: {
    contacto: "Cliente Prueba",
    telefono: "999888777",
    direccion: "Direccion de prueba 123",
    ciudad: "Lima",
  },
  lineas: [{ productoId: 1, cantidad: 2, precioEsperado: 10, impuestoEsperado: 18 }],
};
test("registration distinguishes business and consumer without allowing identity or role overrides", () => {
  assert.ok(registroSchema.safeParse(profile).success);
  assert.equal(registroSchema.safeParse({ ...profile, canal: "b2b" }).success, false);
  assert.ok(
    registroSchema.safeParse({ ...profile, canal: "b2b", documento: "20998877661" }).success,
  );
  for (const extra of [{ admin: 1 }, { clienteId: 1 }, { userId: 1 }, { rol: "admin" }])
    assert.equal(registroSchema.safeParse({ ...profile, ...extra }).success, false);
  assert.equal(registroSchema.safeParse({ ...profile, nombre: "<b>cliente</b>" }).success, false);
});
test("checkout allows a purchase channel but cannot supply identity, price total or payment status", () => {
  assert.ok(compraSchema.safeParse(order).success);
  for (const canal of ["b2b", "b2c"])
    assert.ok(compraSchema.safeParse({ ...order, canal }).success);
  for (const extra of [
    { clienteId: 1 },
    { usuarioId: 1 },
    { canal: "invalid" },
    { pagada: true },
    { total: 0 },
  ])
    assert.equal(compraSchema.safeParse({ ...order, ...extra }).success, false);
  assert.equal(
    compraSchema.safeParse({ ...order, lineas: [...order.lineas, ...order.lineas] }).success,
    false,
  );
  assert.equal(
    compraSchema.safeParse({ ...order, lineas: [{ ...order.lineas[0], cantidad: 1.5 }] }).success,
    false,
  );
});
test("public reads remain local and writes require same origin and explicit JSON request", () => {
  assert.ok(origenLocal(new Request("http://127.0.0.1:5173/api/tienda")));
  const make = (headers = {}, url = "http://127.0.0.1:5173/api/compra") =>
    new Request(url, { method: "POST", headers });
  assert.ok(
    origenLocal(
      make({
        origin: "http://127.0.0.1:5173",
        "content-type": "application/json",
        "x-bimbo-request": "store",
      }),
      true,
    ),
  );
  assert.equal(origenLocal(make(), true), false);
  assert.equal(origenLocal(make({ origin: "https://example.com" }), true), false);
  assert.equal(origenLocal(new Request("http://public.example/api/tienda")), false);
  assert.equal(
    origenLocal(
      new Request("http://127.0.0.1:5173/api/tienda", {
        headers: { "sec-fetch-site": "cross-site" },
      }),
    ),
    false,
  );
});
test("pending checkout keeps original quantities and totals even after cart and catalog change", () => {
  const shown = lineasCarrito(
    [{ id: 2, cantidad: 9 }],
    { moneda: "PEN", productos: [{ id: 1, precio: 50, impuesto: 18 }] },
    order,
  );
  assert.equal(shown.length, 1);
  assert.equal(shown[0].id, 1);
  assert.equal(shown[0].cantidad, 2);
  assert.equal(shown[0].precio, 10);
  assert.equal(shown[0].precioFinal, 11.8);
  const unavailable = lineasCarrito([], undefined, order);
  assert.equal(unavailable[0].precio, 10);
  assert.equal(unavailable[0].cantidad, 2);
});

const tiers = {
  moneda: "PEN",
  nivelTarifa: 2,
  tarifa: "Mayorista B2B",
  tarifaNormal: "Normal B2C",
  minimoMayorista: 100,
  productos: [
    { id: 1, precio: 8.91, precioNormal: 9.9, impuesto: 18, impuestoNormal: 18 },
    { id: 2, precio: 10, precioNormal: 12, impuesto: 18, impuestoNormal: 18 },
  ],
};
test("wholesale eligibility uses entire basket before tax and switches every line", () => {
  const below = [{ id: 1, cantidad: 11 }];
  assert.equal(condicionMayorista(below, tiers).subtotalMayorista, 98.01);
  assert.equal(condicionMayorista(below, tiers).faltante, 1.99);
  assert.equal(lineasCarrito(below, tiers, null)[0].precio, 9.9);
  const above = [...below, { id: 2, cantidad: 1 }];
  assert.equal(condicionMayorista(above, tiers).mayorista, true);
  assert.deepEqual(
    lineasCarrito(above, tiers, null).map((l) => l.precio),
    [8.91, 10],
  );
  assert.equal(condicionMayorista([{ id: 2, cantidad: 10 }], tiers).mayorista, true);
  assert.equal(condicionMayorista([{ id: 2, cantidad: 9 }], tiers).mayorista, false); // Tax-inclusive 106.20 must not qualify.
});
test("B2C is unaffected, zero disables threshold, pending request retains original prices", () => {
  assert.equal(
    condicionMayorista([{ id: 2, cantidad: 100 }], { ...tiers, nivelTarifa: 1 }).aplica,
    false,
  );
  assert.equal(
    condicionMayorista([{ id: 1, cantidad: 1 }], { ...tiers, minimoMayorista: 0 }).mayorista,
    true,
  );
  const pending = {
    ...order,
    lineas: [{ productoId: 1, cantidad: 1, precioEsperado: 8.91, impuestoEsperado: 18 }],
  };
  assert.equal(lineasCarrito([{ id: 1, cantidad: 1 }], tiers, pending)[0].precio, 8.91);
});
test("threshold comparison rounds each line to cents, including fractional admin quantities", () => {
  const catalog = {
    ...tiers,
    minimoMayorista: 1.01,
    productos: [{ id: 1, precio: 1.005, impuesto: 18 }],
  };
  assert.equal(condicionMayorista([{ id: 1, cantidad: 1 }], catalog).subtotalMayorista, 1.01);
  assert.equal(condicionMayorista([{ id: 1, cantidad: 1 }], catalog).mayorista, true);
});
