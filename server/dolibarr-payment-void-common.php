<?php
// Pure shared queries/checks: used by the read adapter and rechecked under locks by the writer.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function voidPaymentSql($prefix,$entity,$fid,$hasAccounting=true) {
 $accounting=$hasAccounting ? "(SELECT COUNT(*) FROM {$prefix}accounting_bookkeeping bk WHERE bk.doc_type='bank' AND bk.fk_doc=p.fk_bank AND p.fk_bank>0)" : '0';
 return "SELECT p.rowid,p.ref,p.ref_ext,p.note,p.datep,p.datec,p.num_paiement,p.amount,p.statut,p.fk_export_compta,p.ext_payment_id,p.ext_payment_site,p.fk_paiement,p.fk_bank,own.applied,
 m.code,m.libelle,b.rowid bank_id,b.amount bank_amount,b.rappro,b.fk_bordereau,a.rowid account_id,a.ref account_ref,a.label,a.clos,a.currency_code,
 (SELECT COUNT(*) FROM {$prefix}paiement_facture allpf WHERE allpf.fk_paiement=p.rowid) links,
 (SELECT COUNT(*) FROM {$prefix}paiement otherp WHERE otherp.fk_bank=p.fk_bank AND otherp.rowid<>p.rowid AND p.fk_bank>0) shared_bank,
 (SELECT COUNT(*) FROM {$prefix}bank_url bu WHERE bu.fk_bank=p.fk_bank AND (bu.type NOT IN ('payment','company') OR (bu.type='payment' AND bu.url_id<>p.rowid))) extra_bank_links,
 $accounting accounted_bank
 FROM {$prefix}paiement p JOIN (SELECT fk_paiement,SUM(amount) applied FROM {$prefix}paiement_facture WHERE fk_facture=$fid GROUP BY fk_paiement) own ON own.fk_paiement=p.rowid
 LEFT JOIN {$prefix}c_paiement m ON m.id=p.fk_paiement LEFT JOIN {$prefix}bank b ON b.rowid=p.fk_bank
 LEFT JOIN {$prefix}bank_account a ON a.rowid=b.fk_account AND a.entity=$entity
 WHERE p.entity=$entity ORDER BY p.datep DESC,p.rowid DESC";
}
function voidPaymentFingerprint($r) {
 $values=[];
 foreach(['rowid','ref','ref_ext','datep','num_paiement','statut','fk_export_compta','ext_payment_id','ext_payment_site','fk_paiement','fk_bank','bank_id','rappro','fk_bordereau','account_id','clos','currency_code','links','shared_bank','extra_bank_links','accounted_bank'] as $key) $values[]=(string)($r[$key] ?? '');
 foreach(['amount','applied','bank_amount'] as $key) $values[]=number_format((float)($r[$key] ?? 0),8,'.','');
 return hash('sha256',json_encode($values,JSON_THROW_ON_ERROR));
}
function voidPaymentReason($r,$f,$currency) {
 if(!in_array((int)$f['type'],[0,1],true) || !((int)$f['fk_statut']===1 || ((int)$f['fk_statut']===2 && $f['paye']))) return 'La factura no está pendiente ni pagada. Revísala en Dolibarr.';
 if(!empty($f['multicurrency_code']) && $f['multicurrency_code']!==$currency) return 'La factura utiliza otra moneda. Revísala en Dolibarr.';
 if(!empty($f['accounted'])) return 'La factura ya tiene asientos contables. Revísala en Dolibarr.';
 if((int)$r['links']!==1) return 'El pago está repartido entre varias facturas. Revísalo en Dolibarr.';
 if((float)$r['applied']<=0 || abs((float)$r['amount']-(float)$r['applied'])>0.000001) return 'El importe del pago requiere revisión en Dolibarr.';
 if((int)$r['statut']!==0 || !empty($r['fk_export_compta'])) return 'El pago está validado o exportado a contabilidad. Revísalo en Dolibarr.';
 if(!empty($r['ext_payment_id']) || !empty($r['ext_payment_site'])) return 'El cobro procede de una pasarela externa. Revísalo en Dolibarr.';
 if((int)$r['fk_bank']>0) {
  if(!$r['bank_id'] || !$r['account_id'] || abs((float)$r['bank_amount']-(float)$r['amount'])>0.000001) return 'El movimiento de cuenta no coincide con el pago. Revísalo en Dolibarr.';
  if($r['clos'] || $r['currency_code']!==$currency) return 'La cuenta está cerrada o utiliza otra moneda. Revísala en Dolibarr.';
  if($r['rappro'] || $r['fk_bordereau']) return 'El movimiento está conciliado o incluido en una remesa. Revísalo en Dolibarr.';
  if($r['accounted_bank']) return 'El movimiento ya está contabilizado. Revísalo en Dolibarr.';
  if($r['shared_bank'] || $r['extra_bank_links']) return 'El movimiento está vinculado a otras operaciones. Revísalo en Dolibarr.';
 }
 return null;
}
function voidPaymentAudit($note) {
 $items=[];
 preg_match_all('/(?:^|\n)portal-payment-void-v1:([A-Za-z0-9+\/=]+)(?=\s|$)/',$note ?? '',$matches);
 foreach($matches[1] as $encoded) {
  $item=json_decode(base64_decode($encoded,true) ?: '',true);
  if(is_array($item) && isset($item['solicitudId'],$item['hash'],$item['pago']['id'],$item['fecha'],$item['motivo'],$item['usuario'])) $items[]=$item;
 }
 return $items;
}
