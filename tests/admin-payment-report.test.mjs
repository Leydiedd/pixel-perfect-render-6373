import test from 'node:test';
import assert from 'node:assert/strict';
import {coincidePago,pagosCoincidentes,totalesPagos} from '../src/lib/admin-payment-model.ts';
const payments=[{codigo:'CB',medio:'Tarjeta',demostracion:false,importe:20},{codigo:'YAPE',medio:'Yape',demostracion:true,importe:11.68}];
test('method and type must match the same payment in a mixed invoice',()=>{
 assert.equal(coincidePago(payments,'prueba','CB'),false);
 assert.equal(coincidePago(payments,'real','YAPE'),false);
 assert.equal(coincidePago(payments,'prueba','YAPE'),true);
 assert.equal(coincidePago(payments,'real','CB'),true);
 assert.equal(coincidePago(payments,'todos','todos'),true);
});
test('unpaid invoices are not labelled real or demo',()=>{
 assert.equal(coincidePago([],'sin_pagos','todos'),true);
 assert.equal(coincidePago([],'real','todos'),false);
 assert.equal(coincidePago([],'prueba','todos'),false);
 assert.equal(coincidePago(payments,'sin_pagos','todos'),false);
});
test('totals split allocated amounts and respect matching payments',()=>{
 assert.deepEqual(totalesPagos(payments),{real:20,prueba:11.68});
 assert.deepEqual(totalesPagos(pagosCoincidentes(payments,'prueba','todos')),{real:0,prueba:11.68});
 assert.deepEqual(totalesPagos([]),{real:0,prueba:0});
});
