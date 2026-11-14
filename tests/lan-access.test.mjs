import test from 'node:test';
import assert from 'node:assert/strict';
import { origenLocal } from '../src/lib/store-model.ts';
import { origenPedidoPermitido } from '../src/lib/order-model.ts';
import { crearSolicitudId } from '../src/lib/solicitud-id.ts';
test('Wi-Fi requires exact enabled origin and preserves CSRF protections',()=>{
 const origin='http://192.168.0.209:5173', old=process.env.BIMBO_LAN_ORIGIN;
 try {
 delete process.env.BIMBO_LAN_ORIGIN;
 assert.equal(origenLocal(new Request(origin+'/api/tienda')),false);
 process.env.BIMBO_LAN_ORIGIN=origin;
 assert.equal(origenLocal(new Request(origin+'/api/tienda')),true);
 for(const url of ['http://192.168.0.208:5173','http://192.168.0.209:5174','https://example.com']) assert.equal(origenLocal(new Request(url+'/api/tienda')),false);
 for(const [kind,fn] of [['store',r=>origenLocal(r,true)],['order',origenPedidoPermitido]]) {
 const headers={origin,'content-type':'application/json','x-bimbo-request':kind};
 const req=h=>new Request(origin+'/api/action',{method:'POST',headers:h});
 assert.equal(fn(req(headers)),true);
 assert.equal(fn(req({...headers,origin:'https://evil.example'})),false);
 assert.equal(fn(req({...headers,'sec-fetch-site':'cross-site'})),false);
 assert.equal(fn(req({...headers,'x-bimbo-request':''})),false);
 assert.equal(fn(req({'content-type':'application/json','x-bimbo-request':kind})),false);
 }
 } finally {if(old===undefined)delete process.env.BIMBO_LAN_ORIGIN;else process.env.BIMBO_LAN_ORIGIN=old;}
});
test('HTTP fallback uses cryptographic bytes and valid unique UUID v4',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 const original=globalThis.crypto;
 try {
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:original.getRandomValues.bind(original)}});
 const ids=Array.from({length:1000},()=>crearSolicitudId());
 assert.equal(new Set(ids).size,1000);
 for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 }finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});

