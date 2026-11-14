<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
// Shared read-only coverage check: fulfilled shipment lines, never a stock mutation.
function deliveryCoverageSql($p,$entity,$id=0){
 $where=$id ? ' AND o.rowid='.(int)$id : '';
 return "SELECT o.rowid pedido_id,d.rowid line_id,d.qty,COALESCE(SUM(CASE WHEN e.fk_statut IN (1,2) AND e.entity=$entity AND e.fk_soc=o.fk_soc THEN ed.qty ELSE 0 END),0) shipped,MAX(CASE WHEN e.fk_statut IN (1,2) AND e.entity=$entity AND e.fk_soc=o.fk_soc THEN e.date_expedition END) last_shipped FROM {$p}commande o JOIN {$p}commandedet d ON d.fk_commande=o.rowid LEFT JOIN {$p}expeditiondet ed ON ed.fk_elementdet=d.rowid AND ed.element_type='commande' LEFT JOIN {$p}expedition e ON e.rowid=ed.fk_expedition WHERE o.entity=$entity AND d.product_type=0 AND d.qty>0 $where GROUP BY o.rowid,d.rowid,d.qty";
}
function deliveryEligible($rows){if(!$rows)return false;foreach($rows as $r)if((float)$r['shipped']+0.000001<(float)$r['qty'] || !$r['last_shipped'])return false;return true;}
function deliveryFieldsExist($query,$prefix){return count($query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='".$prefix."commande_extrafields' AND COLUMN_NAME IN ('bimbo_fecha_entrega','bimbo_recibido_por')"))===2;}
