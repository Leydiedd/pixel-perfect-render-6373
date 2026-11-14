<?php
require __DIR__.'/../server/net-profit-data.php';
$policy=['coverage'=>['2026-01'=>'2026-01-31'],'serviceLines'=>['1'=>'operativo','2'=>'produccion'],'salaryRows'=>['1'=>'administracion','2'=>'produccion'],'accounts'=>['681'=>'depreciacion','401'=>'renta'],'ledgerReady'=>true];
$query=function($sql){
 if(str_contains($sql,'llx_facture f'))return [['mes'=>'2026-01','fecha'=>'2026-01-30','venta'=>1000,'qty'=>1,'buy_price_ht'=>400]];
 if(str_contains($sql,'llx_facture_fourn'))return [['rowid'=>1,'mes'=>'2026-01','total_ht'=>100],['rowid'=>2,'mes'=>'2026-01','total_ht'=>300]];
 if(str_contains($sql,'llx_salary'))return [['rowid'=>1,'mes'=>'2026-01','amount'=>50],['rowid'=>2,'mes'=>'2026-01','amount'=>250]];
 return [['mes'=>'2026-01','numero_compte'=>'681','importe'=>20],['mes'=>'2026-01','numero_compte'=>'401','importe'=>-10],['mes'=>'2026-01','numero_compte'=>'999','importe'=>-10]];
};
function check($value,$message){if(!$value)throw new Exception($message);}
$r=bimboNetProfit($query,1,$policy)[0];
check($r['neta']===440.0,'No duplicar producción, ignorar contrapartidas, conservar reversión de renta');
unset($policy['salaryRows'][1]);check(bimboNetProfit($query,1,$policy)[0]['neta']===null,'Nómina desconocida invalida resultado');
$policy['salaryRows'][1]='administracion';$policy['coverage']['2026-01']='2026-01-13';check(bimboNetProfit($query,1,$policy)[0]['neta']===null,'Ventas posteriores al corte invalidan resultado');
$policy['coverage']=[];check(bimboNetProfit($query,1,$policy)[0]['neta']===null,'Mes sin cierre no inventa ganancia');
echo "4 comprobaciones financieras correctas\n";

