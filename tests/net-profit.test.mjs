import test from 'node:test';
import assert from 'node:assert/strict';
import {filtrarMeses,reporteNeto,resumenNeto} from '../src/lib/net-profit.ts';
import {datosExplicacionExportacion} from '../src/lib/report-export-comment.ts';
import {crearPDF} from '../src/lib/report-export.ts';
test('monthly filters include complete months and unknown profit is excluded rather than zero',()=>{
 const rows=[{mes:'2026-01',neta:100,ventas:200,bruto:150,operativos:50},{mes:'2026-02',neta:null,ventas:800,bruto:700}];
 assert.equal(filtrarMeses(rows,'2026-01-15','2026-01-20').length,1);
 assert.equal(resumenNeto(rows).neta,100);assert.equal(resumenNeto(rows).ventas,200);assert.equal(resumenNeto(rows).incompletos,1);
 assert.deepEqual(reporteNeto(rows,true).columnas.map(c=>c.key),['mes','neta','estado','corte']);
});
test('AI export aggregates ALL filtered rows, keeps missing values, and does not sum percentages',()=>{
 const report={titulo:'Productos',nota:'',columnas:[{key:'ventas',titulo:'Ventas',formato:'dinero'},{key:'ratio',titulo:'Margen %',formato:'porcentaje'}],filas:[]};
 const rows=Array.from({length:80},(_,i)=>({ventas:i===79?null:10,ratio:30}));const data=datosExplicacionExportacion(report,rows);
 assert.equal(data.totalFiltrado,80);assert.equal(data.muestraPrimerasFilas.length,30);assert.equal(data.totalesMonetarios.length,1);assert.equal(data.totalesMonetarios[0].sumaConocida,790);assert.equal(data.totalesMonetarios[0].filasSinDato,1);
 assert.deepEqual(datosExplicacionExportacion({...report,columnas:[{key:'indicador',titulo:'Indicador'},...report.columnas]},rows).totalesMonetarios,[]);
});
test('PDF paginates the full AI explanation and preserves all monthly rows',async()=>{
 const rows=Array.from({length:25},(_,i)=>({mes:`Mes ${i+1}`,neta:100,estado:'Estimación académica',corte:'2026-11-13'}));const report=reporteNeto(rows,true);
 const doc=await crearPDF(report,report.filas,{empresa:'Bimbo',periodo:'Todo el historial',canal:'Global',consultado:'13/11/2026',moneda:'PEN'},{texto:'Explicación completa de los resultados. '.repeat(130)+'FIN_EXPLICACION',generadoEn:'2026-11-13T22:00:00Z'});
 const output=doc.output();assert.ok(doc.getNumberOfPages()>=3);assert.match(output,/FIN_EXPLICACION/);assert.match(output,/Mes 25/);
});
