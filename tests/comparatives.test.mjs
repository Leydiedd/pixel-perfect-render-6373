import test from 'node:test';
import assert from 'node:assert/strict';
import {comparativasComerciales,crecimientoPorCanal,filtrarOrigen} from '../src/lib/comparatives-model.ts';
const f=(id,extra={})=>({id,clienteId:id,fecha:'2026-10-10',canal:'b2c',tipo:0,estado:1,subtotal:100,total:118,saldo:0,pagada:true,origenDatos:'academico',...extra});
const d=(facturas,pagos=[])=>({facturas,pedidos:[],productos:[],reportes:{pagos,ventasLineas:[],compras:[],produccion:[]}});
const filters={desde:'2026-10-01',hasta:'2026-10-31',canal:'todos'};
test('compare channels without hiding B2C behind B2B revenue; credits do not count as purchases',()=>{
const x=d([f(1),f(2,{subtotal:50}),f(3,{tipo:2,subtotal:-10}),f(4,{estado:3}),f(5,{estado:0}),f(6,{tipo:4}),f(7,{canal:'b2b',subtotal:100000})]);
const result=comparativasComerciales(x,filters);assert.equal(result.canales[1].compras,2);assert.equal(result.canales[1].ventas,140);assert.equal(result.canales[1].ticket,75);assert.equal(result.canales[0].compras,1);
});
test('payment percentages use their own channel denominator and payment date, including old invoices',()=>{
const x=d([f(1,{fecha:'2026-09-01'}),f(2),f(3,{canal:'b2b'})],[{facturaId:1,fecha:'2026-10-02',metodo:'Yape',importe:118},{facturaId:2,fecha:'2026-10-02',metodo:'Plin',importe:118},{facturaId:3,fecha:'2026-10-02',metodo:'VIR',importe:118},{facturaId:2,fecha:'2026-09-02',metodo:'Yape',importe:1}]);
const m=comparativasComerciales(x,filters).metodos;assert.equal(m.find(m=>m.metodo==='Yape').pctB2c,50);assert.equal(m.find(m=>m.metodo==='VIR').pctB2b,100);
});
test('origin filters invoices and their payments without reclassifying portal tests',()=>{
const x=d([f(1),f(2,{origenDatos:'portal'}),f(3,{origenDatos:undefined})],[{facturaId:1,fecha:'2026-10-02',metodo:'Yape',importe:118},{facturaId:2,fecha:'2026-10-02',metodo:'Yape',importe:118}]);
assert.deepEqual(filtrarOrigen(x,'portal').facturas.map(f=>f.id),[2]);assert.equal(comparativasComerciales(filtrarOrigen(x,'academico'),filters).metodos[0].b2c,1);assert.equal(filtrarOrigen(x,'historico').facturas[0].id,3);
});
test('growth needs the immediately preceding month and excludes partially selected months',()=>{
const x=d([f(1,{fecha:'2026-08-01',subtotal:100}),f(2,{fecha:'2026-09-01',subtotal:200}),f(3,{fecha:'2026-10-01',subtotal:300}),f(4,{fecha:'2026-12-01',subtotal:400})]);
assert.equal(crecimientoPorCanal(x,filters)[0].b2c,50);assert.deepEqual(crecimientoPorCanal(x,{...filters,desde:'2026-10-02'}),[]);assert.deepEqual(crecimientoPorCanal(x,{...filters,hasta:'2026-10-30'}),[]);assert.equal(crecimientoPorCanal(x,{...filters,desde:'2026-12-01',hasta:'2026-12-31'})[0].b2c,null);
});
test('new versus existing clients uses first purchase before selected period',()=>{
const x=d([f(1,{clienteId:10,fecha:'2026-09-01'}),f(2,{clienteId:10}),f(3,{clienteId:11})]);const c=comparativasComerciales(x,filters).canales[1];assert.equal(c.nuevos,1);assert.equal(c.recurrentes,1);
});

test('channel cards distinguish sales, purchase count, average ticket and gross margin',()=>{
 const x=d([f(1,{canal:'b2b',subtotal:100000}),f(2,{subtotal:100}),f(3,{subtotal:50})]);
 x.reportes.ventasLineas=[{facturaId:1,venta:100000,costo:60000},{facturaId:2,venta:100,costo:50},{facturaId:3,venta:50,costo:30}];
 const [b,c]=comparativasComerciales(x,filters).canales;
 assert.equal(b.compras,1);assert.equal(b.ventas,100000);assert.equal(b.ticket,100000);assert.equal(b.margen,40000);assert.equal(b.porcentajeMargen,40);
 assert.equal(c.compras,2);assert.equal(c.ventas,150);assert.equal(c.ticket,75);assert.equal(c.margen,70);assert.ok(Math.abs(c.porcentajeMargen-46.66666667)<0.00001);
});
test('credit notes reduce channel sales and costs without becoming purchases',()=>{
 const x=d([f(1),f(2,{tipo:2,subtotal:-20}),f(3,{estado:3}),f(4,{estado:0}),f(5,{tipo:4})]);
 x.reportes.ventasLineas=[{facturaId:1,venta:100,costo:60},{facturaId:2,venta:-20,costo:-12},{facturaId:3,venta:100,costo:1}];
 const c=comparativasComerciales(x,filters).canales[1];assert.equal(c.ventas,80);assert.equal(c.margen,32);assert.equal(c.porcentajeMargen,40);assert.equal(c.compras,1);assert.equal(c.ticket,100);
});
test('incomplete costs suppress only the affected channel margin; origin and date stay scoped',()=>{
 const x=d([f(1,{canal:'b2b'}),f(2),f(3,{origenDatos:'portal'}),f(4,{fecha:'2026-09-01'})]);
 x.reportes.ventasLineas=[{facturaId:1,venta:100,costo:60},{facturaId:2,venta:100,costo:null},{facturaId:3,venta:100,costo:0},{facturaId:4,venta:100,costo:0}];
 const [b,c]=comparativasComerciales(filtrarOrigen(x,'academico'),filters).canales;assert.equal(b.margen,40);assert.equal(c.ventas,100);assert.equal(c.margen,null);assert.equal(c.porcentajeMargen,null);
 const selected=comparativasComerciales(x,{...filters,canal:'b2b'}).canales;assert.equal(selected[1].documentos,0);assert.equal(selected[1].margen,null);
});
test('missing lines, empty channels and nonpositive net sales never create a margin percentage',()=>{
 assert.equal(comparativasComerciales(d([f(1)]),filters).canales[1].margen,null);
 const empty=comparativasComerciales(d([]),filters).canales[0];assert.equal(empty.margen,null);assert.equal(empty.ticket,null);assert.equal(empty.porcentajeMargen,null);
 const x=d([f(1),f(2,{tipo:2,subtotal:-100})]);x.reportes.ventasLineas=[{facturaId:1,venta:100,costo:60},{facturaId:2,venta:-100,costo:-60}];
 const c=comparativasComerciales(x,filters).canales[1];assert.equal(c.margen,0);assert.equal(c.porcentajeMargen,null);
});

