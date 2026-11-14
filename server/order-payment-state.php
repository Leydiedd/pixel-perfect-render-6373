<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
// Shared by the read-only snapshot and both final handover writers.
function orderPaymentSql($p,$entity,$id=0){
 $filter=$id?' AND o.rowid='.(int)$id:'';
 return "SELECT o.rowid pedido_id,o.fk_soc order_customer,f.rowid invoice_id,f.fk_soc invoice_customer,f.entity invoice_entity,f.ref,f.type,f.fk_statut,f.paye,f.total_ttc,
 COALESCE((SELECT SUM(pf.amount) FROM {$p}paiement_facture pf JOIN {$p}paiement pay ON pay.rowid=pf.fk_paiement AND pay.entity=f.entity WHERE pf.fk_facture=f.rowid),0) paid,
 COALESCE((SELECT SUM(rc.amount_ttc) FROM {$p}societe_remise_except rc JOIN {$p}facture source ON source.rowid=rc.fk_facture_source AND source.entity=f.entity AND source.fk_soc=f.fk_soc WHERE rc.fk_facture=f.rowid AND source.type IN (0,2,3,5)),0) credits
 FROM {$p}commande o LEFT JOIN {$p}element_element ee ON ee.fk_source=o.rowid AND ee.sourcetype='commande' AND ee.targettype='facture' LEFT JOIN {$p}facture f ON f.rowid=ee.fk_target WHERE o.entity=$entity $filter ORDER BY o.rowid,f.rowid";
}
function orderPaymentBlock($rows,$entity){
 $seen=[];$count=0;
 foreach($rows as $r){
  if(empty($r['invoice_id']))continue;
  if((int)$r['invoice_entity']!==$entity||(int)$r['invoice_customer']!==(int)$r['order_customer'])return 'Revisa la factura vinculada al pedido en Dolibarr.';
  if((int)$r['type']===2)continue; // A credit note by itself is not a paid sales invoice.
  if(isset($seen[$r['invoice_id']]))continue;$seen[$r['invoice_id']]=true;$count++;
  if(!in_array((int)$r['type'],[0,1,5],true)||!in_array((int)$r['fk_statut'],[1,2],true))return 'La factura del pedido debe estar validada y pagada; no puede estar en borrador ni anulada.';
  foreach(['total_ttc','paid','credits'] as $key)if(!is_numeric($r[$key])||!is_finite((float)$r[$key])||(float)$r[$key]<0)return 'No se pudo verificar el saldo de la factura. Revísala en Dolibarr.';
  $cents=fn($v)=>(int)round((float)$v*100);
  if($cents($r['total_ttc'])-$cents($r['paid'])-$cents($r['credits'])>0)return 'Pago pendiente: la factura debe estar pagada por completo antes de confirmar la entrega o el retiro.';
  if(!(int)$r['paye'])return 'La factura aún no figura como pagada en Dolibarr. Revisa y confirma su liquidación.';
 }
 return $count?null:'El pedido no tiene una factura de venta vinculada. Registra y paga su factura antes de confirmar la entrega o el retiro.';
}
function lockedOrderPaymentBlock($query,$p,$entity,$id){
 // The caller owns the shared bimbo-orders lock and the native order row lock.
 // Lock invoice/payment/credit rows before the first consistent balance read.
 $links=$query("SELECT ee.rowid,f.rowid invoice_id FROM {$p}element_element ee JOIN {$p}commande o ON o.rowid=ee.fk_source AND o.entity=$entity JOIN {$p}facture f ON f.rowid=ee.fk_target WHERE ee.sourcetype='commande' AND ee.targettype='facture' AND o.rowid=".(int)$id." ORDER BY f.rowid FOR UPDATE");
 $ids=array_unique(array_map(fn($r)=>(int)$r['invoice_id'],$links));
 if($ids){$list=implode(',',$ids);$query("SELECT pf.rowid,p.rowid payment_id FROM {$p}paiement_facture pf JOIN {$p}paiement p ON p.rowid=pf.fk_paiement WHERE pf.fk_facture IN ($list) FOR UPDATE");$query("SELECT rc.rowid FROM {$p}societe_remise_except rc WHERE rc.fk_facture IN ($list) FOR UPDATE");}
 return orderPaymentBlock($query(orderPaymentSql($p,$entity,$id)),$entity);
}
