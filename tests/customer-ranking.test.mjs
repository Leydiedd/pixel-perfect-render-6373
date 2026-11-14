import test from 'node:test';
import assert from 'node:assert/strict';
import { rankingClientesPorCanal } from '../src/lib/customer-ranking.ts';
const filtros = {desde:'2026-11-01',hasta:'2026-11-30',canal:'todos'};
const f = (id, extra={}) => ({id,clienteId:id,cliente:'Mismo nombre',fecha:'2026-11-10',canal:'b2c',tipo:0,estado:1,subtotal:100,...extra});
test('customer rankings keep IDs and invoice channels separate, subtract credits, and exclude invalid documents',()=>{
 const facturas=[f(1,{clienteId:10,subtotal:300}),f(2,{clienteId:10,tipo:2,subtotal:-50}),f(3,{clienteId:20,subtotal:400}),f(4,{clienteId:10,canal:'b2b',subtotal:10000}),f(5,{estado:0}),f(6,{estado:3}),f(7,{tipo:4}),f(8,{clienteId:null}),f(9,{subtotal:-10})];
 const [c,b]=rankingClientesPorCanal({facturas},filtros);
 assert.deepEqual(c.ranking.map(x=>[x.id,x.ventas,x.compras]),[[20,400,1],[10,250,1]]);
 assert.equal(c.sinCliente,1);assert.equal(c.clientesConVentas,2);
 assert.deepEqual(b.ranking.map(x=>[x.id,x.ventas,x.compras]),[[10,10000,1]]);
});
test('rankings honor date and channel and return empty states',()=>{
 const datos={facturas:[f(1),f(2,{canal:'b2b'}),f(3,{fecha:'2026-10-10',subtotal:9999})]};
 const result=rankingClientesPorCanal(datos,{...filtros,canal:'b2c'});
 assert.equal(result.length,1);assert.deepEqual(result[0].ranking.map(c=>c.id),[1]);
 assert.deepEqual(rankingClientesPorCanal(datos,{...filtros,canal:'sin_clasificar'}),[]);
 assert.ok(rankingClientesPorCanal({facturas:[]},filtros).every(c=>c.ranking.length===0));
});
test('top ten is sorted by money, not purchase count, with stable ties',()=>{
 const facturas=Array.from({length:12},(_,i)=>f(i+1,{subtotal:(i+1)*100}));
 facturas.push(f(30,{clienteId:1,subtotal:10}),f(31,{clienteId:1,subtotal:10}));
 const [c]=rankingClientesPorCanal({facturas},filtros);
 assert.equal(c.clientesConVentas,12);assert.equal(c.ranking.length,10);
 assert.deepEqual(c.ranking.map(c=>c.id),[12,11,10,9,8,7,6,5,4,3]);
 const [ties]=rankingClientesPorCanal({facturas:[f(2),f(1)]},filtros);
 assert.deepEqual(ties.ranking.map(c=>c.id),[1,2]);
});