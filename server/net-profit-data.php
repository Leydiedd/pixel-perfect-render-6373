<?php
// Shared by the read-only dashboard and the explicit academic migration.
function bimboNetProfit(callable $query, int $entity, array $policy): array {
 $months=[];
 $blank=fn($m)=>['mes'=>$m,'ventas'=>0.0,'costo'=>0.0,'servicios'=>0.0,'nomina'=>0.0,'beneficios'=>0.0,'depreciacion'=>0.0,'financieros'=>0.0,'renta'=>0.0,'otros'=>0.0,'sinClasificar'=>0,'sinCosto'=>0,'ultimaVenta'=>''];
 foreach($query("SELECT DATE_FORMAT(f.datef,'%Y-%m') mes,f.datef fecha,d.total_ht venta,d.qty,d.buy_price_ht FROM llx_facture f JOIN llx_facturedet d ON d.fk_facture=f.rowid WHERE f.entity=$entity AND f.fk_statut NOT IN(0,3) AND f.type<>4") as $r){
  if(!$r['mes'])continue;$m=$r['mes'];$months[$m]??=$blank($m);
  $months[$m]['ventas']+=round((float)$r['venta']*100);
  if($r['buy_price_ht']===null)$months[$m]['sinCosto']++;else $months[$m]['costo']+=round(round(((float)$r['venta']<0?-1:1)*abs((float)$r['qty'])*(float)$r['buy_price_ht'],2)*100);
  $months[$m]['ultimaVenta']=max($months[$m]['ultimaVenta'],substr($r['fecha'],0,10));
 }
 foreach($months as &$money){$money['ventas']/=100;$money['costo']/=100;}unset($money);
 foreach($query("SELECT d.rowid,DATE_FORMAT(f.datef,'%Y-%m') mes,d.total_ht FROM llx_facture_fourn f JOIN llx_facture_fourn_det d ON d.fk_facture_fourn=f.rowid WHERE f.entity=$entity AND f.fk_statut NOT IN(0,3) AND (d.fk_product IS NULL OR d.fk_product=0)") as $r){
  $m=$r['mes'];if(!$m)continue;$months[$m]??=$blank($m);$kind=$policy['serviceLines'][$r['rowid']]??null;
  if($kind==='operativo')$months[$m]['servicios']+=round((float)$r['total_ht'],2);elseif($kind!=='produccion')$months[$m]['sinClasificar']++;
 }
 foreach($query("SELECT rowid,DATE_FORMAT(datesp,'%Y-%m') mes,amount FROM llx_salary WHERE entity=$entity") as $r){
  $m=$r['mes'];if(!$m)continue;$months[$m]??=$blank($m);$kind=$policy['salaryRows'][$r['rowid']]??null;
  if($kind==='administracion')$months[$m]['nomina']+=round((float)$r['amount'],2);elseif($kind!=='produccion')$months[$m]['sinClasificar']++;
 }
 if(!empty($policy['ledgerReady']))foreach($query("SELECT DATE_FORMAT(doc_date,'%Y-%m') mes,numero_compte,SUM(debit-credit) importe FROM llx_accounting_bookkeeping WHERE entity=$entity AND code_journal='BIMBO' GROUP BY mes,numero_compte") as $r){
  $m=$r['mes'];$months[$m]??=$blank($m);$k=$policy['accounts'][$r['numero_compte']]??null;if($k)$months[$m][$k]+=round((float)$r['importe'],2);
 }
 ksort($months);$out=[];
 foreach($months as $m=>$r){
  $cut=$policy['coverage'][$m]??null;$complete=$cut && $r['ultimaVenta']<=$cut && !$r['sinClasificar'] && !$r['sinCosto'];
  $r['corte']=$cut;$r['estado']=!$complete?'Datos incompletos':($cut<date('Y-m-t',strtotime($m.'-01'))?'Provisional':'Estimación académica');
  foreach(['servicios','nomina','beneficios','depreciacion','financieros','renta','otros'] as $k)$r[$k]=round($r[$k],2);
  $r['bruto']=$r['sinCosto']?null:round($r['ventas']-$r['costo'],2);
  $r['operativos']=round($r['servicios']+$r['nomina']+$r['beneficios']+$r['otros'],2);
  $r['antesRenta']=$r['bruto']===null?null:round($r['bruto']-$r['operativos']-$r['depreciacion']-$r['financieros'],2);
  $r['neta']=$complete?round($r['antesRenta']-$r['renta'],2):null;
  unset($r['ultimaVenta']);$out[]=$r;
 }return $out;
}
