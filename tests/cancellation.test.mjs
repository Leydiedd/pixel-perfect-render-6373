import test from "node:test";
import assert from "node:assert/strict";
import {
  cancelarPedidoSchema,
  pedidoCanceladoSchema,
  origenPedidoPermitido,
} from "../src/lib/order-model.ts";
import { estadoFactura, estadoPedido, estadoExpedicion } from "../src/lib/dolibarr-model.ts";

test("cancellation requires an explicit order and reason; client cannot supply quantities or invoice IDs", () => {
  const body = { pedidoId: 42, motivo: "Cliente anuló el pedido" };
  assert.equal(cancelarPedidoSchema.safeParse(body).success, true);
  for (const change of [
    { pedidoId: 0 },
    { pedidoId: "42" },
    { motivo: "  " },
    { motivo: "x".repeat(501) },
    { facturaId: 99 },
    { stock: 10 },
  ])
    assert.equal(cancelarPedidoSchema.safeParse({ ...body, ...change }).success, false);
  assert.equal(
    origenPedidoPermitido(
      new Request("http://127.0.0.1:5173/api/pedidos", {
        method: "PATCH",
        headers: {
          origin: "https://other.invalid",
          "content-type": "application/json",
          "x-bimbo-request": "order",
        },
      }),
    ),
    false,
  );
});
test("successful cancellation must include annulled invoice, cancelled shipment and positive return movements", () => {
  const result = {
    ok: true,
    repetido: false,
    motivo: "Prueba",
    pedido: { id: 1, ref: "SO-1", estado: -1 },
    factura: { id: 1, ref: "IN-1", estado: 3 },
    expedicion: { id: 1, ref: "SH-1", estado: -1 },
    stock: {
      almacen: { id: 1, nombre: "Planta" },
      lineas: [{ productoId: 1, sku: "PAN", cantidad: 2.125, movimientoId: 7 }],
    },
  };
  assert.equal(pedidoCanceladoSchema.safeParse(result).success, true);
  assert.equal(
    pedidoCanceladoSchema.safeParse({ ...result, factura: { ...result.factura, estado: 1 } })
      .success,
    false,
  );
  assert.equal(
    pedidoCanceladoSchema.safeParse({
      ...result,
      stock: { ...result.stock, lineas: [{ ...result.stock.lineas[0], cantidad: -2 }] },
    }).success,
    false,
  );
  assert.equal(estadoFactura({ estado: 3, pagada: false }), "Anulada");
  assert.equal(estadoPedido(-1), "Cancelado");
  assert.equal(estadoExpedicion(-1), "Cancelada");
});
