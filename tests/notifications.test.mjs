import test from 'node:test';import assert from 'node:assert/strict';
import {leerAvisosSchema,textoAviso,avisosSchema} from '../src/lib/notifications-model.ts';
const base={id:1,pedidoId:1441,pedidoRef:'SO-1441',fecha:'2026-11-15',anterior:null,creadaEn:'2026-11-12T20:00:00Z',leida:false};
test('notification messages show the relevant date change without private details',()=>{
 assert.match(textoAviso({...base,tipo:'programada'}).mensaje,/SO-1441.*15/);
 const changed=textoAviso({...base,tipo:'reprogramada',anterior:'2026-11-14'});assert.match(changed.mensaje,/14.*15/);
 assert.equal(textoAviso({...base,tipo:'entregada'}).titulo,'Pedido entregado');
});
test('read mutations reject identity overrides and ambiguous or unbounded selections',()=>{
 assert.ok(leerAvisosSchema.safeParse({ids:[1,2]}).success);assert.ok(leerAvisosSchema.safeParse({hasta:42}).success);
 for(const bad of [{ids:[]},{ids:[1,1]},{ids:[1],hasta:4},{ids:[1],userId:2},{hasta:-1},{ids:Array.from({length:51},(_,i)=>i+1)}])assert.equal(leerAvisosSchema.safeParse(bad).success,false);
});
test('inbox contract preserves unread count even on older pages',()=>{
 const p=avisosSchema.parse({ok:true,notificaciones:[{...base,tipo:'entregada',leida:true}],sinLeer:9,ultimoId:30,antes:1});assert.equal(p.sinLeer,9);assert.equal(p.antes,1);
 assert.equal(avisosSchema.safeParse({...p,sinLeer:-1}).success,false);
});
