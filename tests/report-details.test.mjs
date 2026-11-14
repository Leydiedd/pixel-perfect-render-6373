import test from "node:test";
import assert from "node:assert/strict";
import {
  construirDetalles,
  resumenGerencial,
  periodoAnterior,
  antiguedadSaldo,
} from "../src/lib/report-details.ts";
import { generarCSV } from "../src/lib/report-export.ts";
const filtros = { desde: "2026-11-01", hasta: "2026-11-30", canal: "todos" };
const factura = (id, extra = {}) => ({
  id,
  ref: "F" + id,
  clienteId: id,
  cliente: "Mismo nombre",
  fecha: "2026-11-10",
  estado: 1,
  tipo: 0,
  canal: "b2b",
  fuenteCanal: "documento",
  subtotal: 100,
  total: 118,
  impuesto: 18,
  saldo: 118,
  cobrado: 0,
  pagada: false,
  vencimiento: "2026-11-20",
  ...extra,
});
const data = (facturas, lineas = []) => ({
  facturas,
  productos: [],
  pedidos: [],
  reportes: { ventasLineas: lineas, pagos: [], compras: [], produccion: [] },
});
test("same-length prior periods handle month and leap-year boundaries", () => {
  assert.deepEqual(periodoAnterior("2026-11-01", "2026-11-30"), {
    desde: "2026-10-02",
    hasta: "2026-10-31",
    dias: 30,
  });
  assert.deepEqual(periodoAnterior("2024-03-01", "2024-03-01"), {
    desde: "2024-02-29",
    hasta: "2024-02-29",
    dias: 1,
  });
  for (const pair of [
    ["", ""],
    ["2026-11-30", "2026-11-01"],
    ["2026-02-30", "2026-03-02"],
  ])
    assert.equal(periodoAnterior(...pair), null);
});
test("net sales and margin preserve credit notes, exclude drafts, cancelled and proformas", () => {
  const d = data(
    [
      factura(1),
      factura(2, { tipo: 2, subtotal: -20, total: -23.6, impuesto: -3.6, saldo: 0 }),
      factura(3, { estado: 0 }),
      factura(4, { estado: 3 }),
      factura(5, { tipo: 4 }),
    ],
    [
      { facturaId: 1, sku: "PAN", producto: "Pan", cantidad: 10, venta: 100, costo: 60 },
      { facturaId: 2, sku: "PAN", producto: "Pan", cantidad: -2, venta: -20, costo: -12 },
    ],
  );
  const r = resumenGerencial(d, filtros);
  assert.equal(r.ventas, 80);
  assert.equal(r.margen, 32);
  assert.equal(r.ticket, 100);
  assert.equal(r.facturas.length, 2);
  const p = construirDetalles(d, filtros, "2026-11-21").Productos.filas[0];
  assert.equal(p.cantidad, 8);
  assert.equal(p.costo, 48);
  assert.equal(p.margen, 32);
});
test("missing cost or missing invoice lines never becomes invented profit", () => {
  assert.equal(resumenGerencial(data([factura(1)]), filtros).margen, null);
  assert.equal(
    resumenGerencial(
      data([factura(1)], [{ facturaId: 1, sku: "A", cantidad: 1, venta: 100, costo: null }]),
      filtros,
    ).margen,
    null,
  );
  assert.equal(
    resumenGerencial(
      data([factura(1)], [{ facturaId: 1, sku: "A", cantidad: 1, venta: 90, costo: 40 }]),
      filtros,
    ).margen,
    null,
  );
});
test("customers with identical names stay separate by Dolibarr ID and channels combine within one ID", () => {
  const d = data([
    factura(1, { clienteId: 10 }),
    factura(2, { clienteId: 20 }),
    factura(3, { clienteId: 10, canal: "b2c" }),
  ]);
  const rows = construirDetalles(d, filtros, "2026-11-21").Clientes.filas;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ventas, 200);
  assert.equal(rows[0].canal, "B2B / B2C");
  const b2c = construirDetalles(d, { ...filtros, canal: "b2c" }, "2026-11-21").Clientes.filas;
  assert.equal(b2c.length, 1);
  assert.equal(b2c[0].ventas, 100);
});
test("collection period uses payment date even for an earlier invoice and excludes orphan/cancelled applications", () => {
  const d = data([factura(1, { fecha: "2026-10-01" }), factura(2, { estado: 3 })]);
  d.reportes.pagos = [
    { facturaId: 1, fecha: "2026-11-03", importe: 25, metodo: "Yape" },
    { facturaId: 1, fecha: "2026-10-03", importe: 40, metodo: "Yape" },
    { facturaId: 2, fecha: "2026-11-03", importe: 30, metodo: "Yape" },
    { facturaId: 99, fecha: "2026-11-03", importe: 50, metodo: "Yape" },
  ];
  const r = resumenGerencial(d, filtros);
  assert.equal(r.ventas, 0);
  assert.equal(r.cobros, 25);
  assert.equal(construirDetalles(d, filtros, "2026-11-21").Pagos.filas.length, 1);
});
test("aging boundaries, due-today and missing due date remain distinct", () => {
  assert.deepEqual(antiguedadSaldo(null, "2026-11-21"), { tramo: "Sin vencimiento", dias: null });
  assert.equal(antiguedadSaldo("2026-11-21", "2026-11-21").tramo, "Por vencer / vence hoy");
  for (const [n, expected] of [
    [1, "1–30 días"],
    [30, "1–30 días"],
    [31, "31–60 días"],
    [60, "31–60 días"],
    [61, "61–90 días"],
    [90, "61–90 días"],
    [91, "Más de 90 días"],
  ]) {
    const due = new Date(Date.parse("2026-11-21T00:00:00Z") - n * 86400000)
      .toISOString()
      .slice(0, 10);
    assert.equal(antiguedadSaldo(due, "2026-11-21").tramo, expected);
  }
});
test("inventory ignores commercial period; pickup is not counted as a late delivery", () => {
  const d = data([]);
  d.productos = [
    { sku: "P", nombre: "Pan", gestionaStock: true, stock: 5, umbral: 10, unidad: "u" },
  ];
  d.pedidos = [
    {
      ref: "P1",
      cliente: "C",
      fecha: "2026-11-10",
      estado: 3,
      canal: "b2b",
      modalidad: "recojo",
      listoRecojo: "2026-11-11",
      entrega: "2026-11-12",
      fechaEntregaReal: null,
    },
  ];
  const r = construirDetalles(d, filtros, "2026-11-21");
  assert.equal(r.Inventario.filas[0].situacion, "Bajo mínimo");
  assert.equal(r.Entregas.filas[0].cumplimiento, "Listo para recoger");
});
test("CSV exports full filtered rows, quotes labels, neutralizes formulas and keeps negative amounts numeric", () => {
  const report = {
    titulo: "Prueba",
    nota: "Notas",
    columnas: [
      { key: "nombre", titulo: "Nombre" },
      { key: "importe", titulo: "Importe" },
    ],
    filas: [],
  };
  const ctx = {
    empresa: "Empresa",
    periodo: "Todo",
    canal: "B2C",
    consultado: "2026-11-21",
    moneda: "PEN",
  };
  const csv = generarCSV(
    report,
    [
      { nombre: '=HYPERLINK("bad")', importe: -20 },
      { nombre: 'Pan; "A"', importe: 10 },
    ],
    ctx,
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"-20"'));
  assert.ok(csv.includes('"Pan; ""A""";"10"'));
});
