<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
// Called within the delivery transaction: an event exists only if its change commits.
function portalDeliveryNotification($order,$kind,$nonce,$date,$previous=null){
 global $db,$conf;
 if(!in_array($kind,['programada','reprogramada','entregada','listo_recojo','retirado'],true))throw new RuntimeException('Invalid delivery notification');
 $p=MAIN_DB_PREFIX;$entity=(int)$conf->entity;$orderId=(int)$order->id;$customer=(int)$order->socid;
 if($orderId<=0||$customer<=0)throw new RuntimeException('Notification has no owner');
 $event=(in_array($kind,['listo_recojo','retirado'],true)?'pickup:'.$kind.':':($kind==='entregada'?'delivery:':'plan:')).$nonce;
 $old=$previous===null?'NULL':"'".$db->escape($previous)."'";
 $sql="INSERT INTO {$p}bimbo_notification (entity,fk_soc,fk_commande,event_key,kind,event_date,previous_date,created_at) VALUES ($entity,$customer,$orderId,'".$db->escape($event)."','".$db->escape($kind)."','".$db->escape($date)."',$old,UTC_TIMESTAMP())";
 if(!$db->query($sql))throw new RuntimeException('Could not save delivery notification');
}
