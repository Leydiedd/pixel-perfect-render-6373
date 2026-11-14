<?php
require __DIR__.'/../server/order-view.php';
$base=['pedido_id'=>1,'order_customer'=>1,'invoice_customer'=>1,'invoice_entity'=>1,'invoice_id'=>1,'type'=>0,'fk_statut'=>1,'paye'=>0,'ref'=>'F1','total_ttc'=>100,'paid'=>0,'credits'=>0];
$n=0;function check($row,$expected){global $n;$r=portalPaymentSummary($row,1);if($r['estado']!==$expected)throw new RuntimeException(json_encode($r));$n++;}
check([$base],'pendiente');check([array_merge($base,['paid'=>20])],'parcial');check([array_merge($base,['paid'=>100,'paye'=>1])],'pagado');check([array_merge($base,['paid'=>0,'paye'=>1])],'pendiente');check([array_merge($base,['paid'=>100])],'por_conciliar');check([array_merge($base,['paid'=>80,'credits'=>20,'paye'=>1])],'pagado');check([],'sin_factura');check([array_merge($base,['fk_statut'=>3])],'revisar');check([array_merge($base,['invoice_customer'=>2])],'revisar');
check([array_merge($base,['paid'=>100,'paye'=>1]),array_merge($base,['invoice_id'=>2])],'parcial');
$r=portalPaymentSummary([$base,$base],1);if($r['total']!==100.0)throw new RuntimeException('duplicate link counted twice');$n++;
if(portalPaymentSummary([$base],1,true)['estado']!=='cancelado')throw new RuntimeException('cancelled');$n++;
echo "$n payment summary checks passed\n";
