import test from 'node:test';import assert from 'node:assert/strict';
import {estadoEntregaCliente} from '../src/lib/customer-delivery.ts';
const today='2026-11-12';const p=(prevista,real,estado=3)=>({estado,fechaPrevista:prevista,fechaEntregaReal:real});
test('customer distinguishes a closed order from a confirmed delivery',()=>{
 assert.equal(estadoEntregaCliente(p(null,null),today).titulo,'Fecha de entrega por confirmar');
 assert.equal(estadoEntregaCliente(p(today,null),today).titulo,'Entrega programada');
 assert.equal(estadoEntregaCliente(p('2026-11-13',null),today).tono,'info');
 const late=estadoEntregaCliente(p('2026-11-11',null),today);assert.equal(late.tono,'retraso');assert.match(late.titulo,/sin confirmar/);assert.match(late.detalle,/1 día/);
});
test('customer sees actual delivery and calendar delay, including unknown planned date',()=>{
 assert.equal(estadoEntregaCliente(p(today,today),today).titulo,'Entregado a tiempo');
 assert.equal(estadoEntregaCliente(p(today,'2026-11-11'),today).titulo,'Entregado a tiempo');
 const late=estadoEntregaCliente(p('2026-10-31','2026-11-02'),today);assert.equal(late.titulo,'Entregado con retraso');assert.match(late.detalle,/2 días/);
 assert.equal(estadoEntregaCliente(p(null,today),today).titulo,'Entregado');
});
test('cancelled and draft orders never look like overdue deliveries',()=>{
 assert.equal(estadoEntregaCliente(p('2026-11-01',today,-1),today).titulo,'Pedido cancelado');
 assert.equal(estadoEntregaCliente(p('2026-11-01',null,0),today).titulo,'Pedido pendiente de confirmación');
 assert.equal(estadoEntregaCliente({estado:3},today).titulo,'Fecha de entrega por confirmar');
});
