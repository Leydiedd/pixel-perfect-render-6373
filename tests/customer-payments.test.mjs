import test from 'node:test';
import assert from 'node:assert/strict';
import {pagoClienteSchema,resultadoPagoClienteSchema} from '../src/lib/customer-payment-model.ts';
const request={solicitudId:'3e523a8f-d5bc-4d6e-83b0-bd6c82428314',facturaId:1441,metodo:'yape',saldoEsperado:11.68};
test('only three simulation methods and an exact positive balance are accepted',()=>{
 for(const metodo of ['tarjeta','yape','plin'])assert.ok(pagoClienteSchema.safeParse({...request,metodo}).success);
 for(const extra of [{metodo:'real'},{saldoEsperado:0},{saldoEsperado:-1},{saldoEsperado:0.001},{saldoEsperado:Infinity},{facturaId:0}])assert.equal(pagoClienteSchema.safeParse({...request,...extra}).success,false);
});
test('customer cannot choose identity, destination, payment amount, date or card data',()=>{
 for(const extra of [{usuarioId:1},{clienteId:1},{cuentaId:1},{medioId:2},{importe:1},{fecha:'2026-11-12'},{tarjeta:'4242424242424242'},{cvv:'123'},{pagada:true}])assert.equal(pagoClienteSchema.safeParse({...request,...extra}).success,false);
});
test('a successful receipt requires native payment, invoice and explicit simulation flag',()=>{
 const r={ok:true,repetido:false,demostracion:true,metodo:'plin',aviso:null,pago:{id:1,ref:'PAY1',importe:11.68,fecha:'2026-11-12'},factura:{id:1441,ref:'F1',estado:2,pagada:true,saldo:0}};
 assert.ok(resultadoPagoClienteSchema.safeParse(r).success);
 assert.equal(resultadoPagoClienteSchema.safeParse({...r,demostracion:false}).success,false);
 assert.equal(resultadoPagoClienteSchema.safeParse({...r,pago:{...r.pago,id:0}}).success,false);
});
