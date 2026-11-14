<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
// Always called before the native transaction commits. A failed event rolls back the action.
function portalAdminNotification($document,$kind,$nonce,$channel,$amount,$method=null,$paymentId=null){
 global $db,$conf;
 if(!in_array($kind,['pedido_cliente','pago_cliente'],true)||!in_array($channel,['b2b','b2c'],true))throw new RuntimeException('Invalid administrator event');
 if($kind==='pago_cliente'&&(!in_array($method,['tarjeta','yape','plin'],true)||!$paymentId))throw new RuntimeException('Invalid payment event');
 $p=MAIN_DB_PREFIX;$entity=(int)$conf->entity;$cid=(int)$document->socid;$id=(int)$document->id;
 $r=$db->query("SELECT nom FROM {$p}societe WHERE rowid=$cid AND entity=$entity");
 $customer=$r?$db->fetch_object($r):null;
 if(!$customer||$id<=0||!is_numeric($amount)||$amount<=0)throw new RuntimeException('Invalid event document');
 $q=fn($v)=>"'".$db->escape($v)."'";
 $event=$kind.':'.strtolower($nonce);$money=number_format((float)$amount,8,'.','');
 $sql="INSERT INTO {$p}bimbo_admin_notification (entity,fk_soc,object_id,object_ref,customer_name,channel,kind,amount,currency,method,fk_paiement,event_key,created_at) VALUES ($entity,$cid,$id,".$q($document->ref).','.$q($customer->nom).','.$q($channel).','.$q($kind).",$money,".$q($conf->currency).','.($method===null?'NULL':$q($method)).','.($paymentId===null?'NULL':(int)$paymentId).','.$q($event).',UTC_TIMESTAMP())';
 if(!$db->query($sql))throw new RuntimeException('Could not save administrator notification');
}
