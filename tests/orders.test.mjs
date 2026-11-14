import test from "node:test";
import assert from "node:assert/strict";
import {
  nuevoPedidoSchema,
  pedidoCreadoSchema,
  origenPedidoPermitido,
} from "../src/lib/order-model.ts";
const pedido = {
  solicitudId: "a0cd5432-abcd-4abc-8abc-001122334455",
  clienteId: 1,
  lineas: [{ productoId: 1, cantidad: 2, precioEsperado: 9.9, impuestoEsperado: 18 }],
};
test("a confirmed order response must include its invoice and PDF outcome", () => {
  const result = {
    ok: true,
    repetido: false,
    pedido: { id: 1, ref: "SO-1", estado: 1, subtotal: 100, impuesto: 18, total: 118 },
    factura: { id: 2, ref: "IN-1", estado: 1, pagada: false, total: 118, pdf: true },
    stock: {
      estado: "descontado",
      almacen: { id: 1, nombre: "Planta" },
      lineas: [{ productoId: 1, sku: "PAN", cantidad: 2, movimientoId: 1 }],
      expedicion: { id: 1, ref: "SH-1", estado: 2 },
    },
    aviso: null,
  };
  assert.equal(pedidoCreadoSchema.safeParse(result).success, true);
  assert.equal(pedidoCreadoSchema.safeParse({ ...result, stock: undefined }).success, false);
  assert.equal(
    pedidoCreadoSchema.safeParse({
      ...result,
      stock: { ...result.stock, expedicion: { ...result.stock.expedicion, estado: 0 } },
    }).success,
    false,
  );
  assert.equal(pedidoCreadoSchema.safeParse({ ...result, factura: undefined }).success, false);
  assert.equal(
    pedidoCreadoSchema.safeParse({ ...result, factura: { ...result.factura, id: 0 } }).success,
    false,
  );
  assert.equal(
    pedidoCreadoSchema.safeParse({
      ...result,
      factura: { ...result.factura, pdf: false },
      aviso: "El PDF puede generarse desde Dolibarr.",
    }).success,
    true,
  );
});
test("accept decimal quantities; reject duplicates, invalid prices and excess precision", () => {
  assert.equal(nuevoPedidoSchema.safeParse(pedido).success, true);
  for (const value of [-1, 0, Infinity, 1.00001, 1000001])
    assert.equal(
      nuevoPedidoSchema.safeParse({ ...pedido, lineas: [{ ...pedido.lineas[0], cantidad: value }] })
        .success,
      false,
    );
  assert.equal(
    nuevoPedidoSchema.safeParse({ ...pedido, lineas: [{ ...pedido.lineas[0], cantidad: 0.0001 }] })
      .success,
    true,
  );
  assert.equal(
    nuevoPedidoSchema.safeParse({ ...pedido, lineas: [...pedido.lineas, ...pedido.lineas] })
      .success,
    false,
  );
  assert.equal(
    nuevoPedidoSchema.safeParse({
      ...pedido,
      lineas: [{ ...pedido.lineas[0], precioEsperado: -1 }],
    }).success,
    false,
  );
  assert.equal(nuevoPedidoSchema.safeParse({ ...pedido, total: 0 }).success, false);
});
test("writes require same origin, local host and explicit JSON header", () => {
  const url = "http://127.0.0.1:5173/api/pedidos";
  const headers = {
    origin: "http://127.0.0.1:5173",
    "x-bimbo-request": "order",
    "content-type": "application/json",
    "sec-fetch-site": "same-origin",
  };
  assert.equal(origenPedidoPermitido(new Request(url, { headers })), true);
  for (const change of [
    { origin: "https://attacker.invalid" },
    { origin: "null" },
    { "x-bimbo-request": "" },
    { "sec-fetch-site": "cross-site" },
    { "content-type": "text/plain" },
  ])
    assert.equal(
      origenPedidoPermitido(new Request(url, { headers: { ...headers, ...change } })),
      false,
    );
  assert.equal(
    origenPedidoPermitido(
      new Request("http://external.invalid/api/pedidos", {
        headers: { ...headers, origin: "http://external.invalid" },
      }),
    ),
    false,
  );
});
