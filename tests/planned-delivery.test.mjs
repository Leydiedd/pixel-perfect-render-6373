import test from 'node:test';import assert from 'node:assert/strict';
import {cumplimientoEntrega,resumenEntregas} from '../src/lib/reports-model.ts';
import {fechaPrevistaSchema} from '../src/lib/delivery-model.ts';
const p=(entrega,fechaEntregaReal,estado=3)=>({estado,entrega,fechaEntregaReal});
test('calendar days distinguish received early, on date, late and unknown',()=>{
 const check=(row,result)=>assert.deepEqual(cumplimientoEntrega(row,'2026-11-12'),result);
 check(p('2026-11-12','2026-11-11'),{estado:'a_tiempo',diasRetraso:0});
 check(p('2026-11-12','2026-11-12'),{estado:'a_tiempo',diasRetraso:0});
 check(p('2024-02-28','2024-03-01'),{estado:'con_retraso',diasRetraso:2});
 check(p('2026-10-31','2026-11-02'),{estado:'con_retraso',diasRetraso:2});
 check(p(null,'2026-11-12'),{estado:'sin_fecha',diasRetraso:null});
 check(p('2026-11-10',null),{estado:'vencido',diasRetraso:2});
 check(p('2026-11-12',null),{estado:'pendiente',diasRetraso:null});
 check(p(null,null),{estado:'sin_programar',diasRetraso:null});
 check(p('2026-11-01',null,-1),{estado:'no_aplica',diasRetraso:null});
});
test('KPIs exclude unknown promises, drafts and cancellations from punctuality',()=>{
 const s=resumenEntregas([p('2026-11-12','2026-11-12'),p('2026-11-11','2026-11-12'),p(null,'2026-11-12'),p('2026-11-10',null),p('2026-11-11',null,0),p('2026-11-11','2026-11-12',-1)],'2026-11-12');
 assert.deepEqual(s,{total:4,entregados:3,sinConfirmar:1,medibles:2,aTiempo:1,conRetraso:1,sinFechaPrevista:1,vencidos:1});
});
test('planned date requires prior value and rejects injected administrator',()=>{
 const r={solicitudId:'3e523a8f-d5bc-4d6e-83b0-bd6c82428314',pedidoId:1,fecha:'2026-11-15',anterior:null};
 assert.ok(fechaPrevistaSchema.safeParse(r).success);
 assert.equal(fechaPrevistaSchema.safeParse({...r,usuarioId:1}).success,false);
 assert.equal(fechaPrevistaSchema.safeParse({...r,anterior:undefined}).success,false);
 assert.equal(fechaPrevistaSchema.safeParse({...r,fecha:''}).success,false);
});
