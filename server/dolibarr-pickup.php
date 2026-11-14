<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');ob_start();$pickupDb=null;$lock=null;
require_once __DIR__.'/order-payment-state.php';
require_once __DIR__.'/delivery-state.php';require_once __DIR__.'/delivery-notifications.php';
class PickupInputError extends RuntimeException{}
function pickupCheck($ok,$message,$status=409){if(!$ok)throw new PickupInputError($message,$status);}
function pickupRows($sql){global $db;$r=$db->query($sql);if(!$r)throw new RuntimeException('Pickup query failed');$out=[];while($row=$db->fetch_array($r))$out[]=$row;return $out;}
try{
 $raw=stream_get_contents(STDIN,8193);pickupCheck(strlen($raw)<=8192,'Solicitud demasiado grande.',400);$input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
 $action=$input['accion']??'';pickupCheck(in_array($action,['listo','retiro'],true),'Acción inválida.',400);
 $keys=array_keys($input);sort($keys);pickupCheck($keys===($action==='listo'?['accion','pedidoId','solicitudId','usuarioId']:['accion','fecha','pedidoId','receptor','solicitudId','usuarioId']),'Solicitud inválida.',400);
 pickupCheck(is_int($input['pedidoId'])&&$input['pedidoId']>0&&is_int($input['usuarioId'])&&$input['usuarioId']>0,'Pedido o usuario inválido.',400);
 pickupCheck(is_string($input['solicitudId'])&&preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i',$input['solicitudId']),'Solicitud inválida.',400);
 $today=(new DateTimeImmutable('now',new DateTimeZone('America/Lima')))->format('Y-m-d');$date=null;$recipient=null;
 if($action==='retiro'){
  $date=is_string($input['fecha'])?DateTimeImmutable::createFromFormat('!Y-m-d',$input['fecha'],new DateTimeZone('America/Lima')):false;
  pickupCheck($date&&$date->format('Y-m-d')===$input['fecha']&&$input['fecha']<=$today,'Indica una fecha válida, no futura.',400);
  pickupCheck(is_string($input['receptor'])&&mb_strlen(trim($input['receptor']))>=2&&mb_strlen($input['receptor'])<=128&&!preg_match('/[<>\x00-\x1f]/',$input['receptor']),'Indica quién retiró el pedido.',400);$recipient=trim($input['receptor']);
 }
 require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?:1);require_once $dolibarr_main_document_root.'/master.inc.php';require_once DOL_DOCUMENT_ROOT.'/commande/class/commande.class.php';$pickupDb=$db;
 pickupCheck($user->fetch($input['usuarioId'])>0&&$user->admin&&$user->statut&&!$user->socid&&in_array((int)$user->entity,[0,(int)$conf->entity],true)&&!$user->isNotIntoValidityDateRange()&&!$user->force_pass_change,'Acceso reservado a administración.',403);$user->loadRights();pickupCheck($user->hasRight('commande','creer'),'Falta permiso para editar pedidos.',403);
 $entity=(int)$conf->entity;$p=MAIN_DB_PREFIX;$id=$input['pedidoId'];$nonce=strtolower($input['solicitudId']);$hash=hash('sha256',json_encode([$id,$action,$input['fecha']??null,$recipient,$input['usuarioId']]));
 $lock='bimbo-orders-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,40);pickupCheck((int)pickupRows("SELECT GET_LOCK('".$db->escape($lock)."',10) n")[0]['n']===1,'Hay otra operación en curso. Reintenta.');$db->begin();
 $rs=pickupRows("SELECT rowid,ref,date_commande,fk_statut,note_private FROM {$p}commande WHERE rowid=$id AND entity=$entity FOR UPDATE");pickupCheck(count($rs)===1,'Pedido no encontrado.',404);$r=$rs[0];
 $xs=pickupRows("SELECT bimbo_modalidad,bimbo_listo_recojo,bimbo_fecha_entrega,bimbo_recibido_por FROM {$p}commande_extrafields WHERE fk_object=$id FOR UPDATE");$x=$xs[0]??[];
 pickupCheck(($x['bimbo_modalidad']??'')==='recojo','Este pedido es para delivery. Usa las acciones de entrega.');pickupCheck(in_array((int)$r['fk_statut'],[1,2,3],true),'El pedido debe estar validado y no cancelado.');
 $repeated=preg_match('/(?:^|\n)portal-pickup-v1:'.preg_quote($nonce,'/').':([a-f0-9]{64})(?=\s|$)/',$r['note_private']??'',$matches);
 if($repeated){
  pickupCheck(hash_equals($matches[1],$hash),'El reintento tiene otro contenido.');
  pickupCheck($action==='listo'?!empty($x['bimbo_listo_recojo']):(substr($x['bimbo_fecha_entrega']??'',0,10)===$input['fecha']&&($x['bimbo_recibido_por']??'')===$recipient),'El estado registrado cambió. Actualiza el pedido.');
 }else{
  pickupCheck(empty($x['bimbo_fecha_entrega'])&&!str_contains($r['note_private']??'','portal-delivery-v1:'),'El pedido ya fue retirado.');
  pickupCheck($action==='listo'?empty($x['bimbo_listo_recojo']):!empty($x['bimbo_listo_recojo']),$action==='listo'?'Ya está listo para recoger.':'Primero marca el pedido como listo para recoger.');
  if($action==='retiro'){$paymentBlock=lockedOrderPaymentBlock('pickupRows',$p,$entity,$id);pickupCheck($paymentBlock===null,$paymentBlock??'');}
  $coverage=pickupRows(deliveryCoverageSql($p,$entity,$id));pickupCheck(deliveryEligible($coverage),'La salida de almacén debe cubrir todos los productos del pedido.');
  $earliest=substr($r['date_commande'],0,10);foreach($coverage as $line)$earliest=max($earliest,substr($line['last_shipped'],0,10));
  $eventDate=$action==='listo'?$today:$input['fecha'];pickupCheck($eventDate>=$earliest&&($action==='listo'||$eventDate>=substr($x['bimbo_listo_recojo'],0,10)),'La fecha no puede ser anterior a la preparación o salida del pedido.');
  $order=new Commande($db);if($order->fetch($id)<=0)throw new RuntimeException('Order fetch failed');
  $dt=new DateTimeImmutable($eventDate);$timestamp=dol_mktime(12,0,0,(int)$dt->format('m'),(int)$dt->format('d'),(int)$dt->format('Y'));
  if($action==='listo'){$order->array_options['options_bimbo_listo_recojo']=$timestamp;if($order->updateExtraField('bimbo_listo_recojo','',$user)<=0)throw new RuntimeException('Ready state update failed');}
  else{
   $order->array_options['options_bimbo_fecha_entrega']=$timestamp;$order->array_options['options_bimbo_recibido_por']=$recipient;
   if($order->updateExtraField('bimbo_fecha_entrega','',$user)<=0||$order->updateExtraField('bimbo_recibido_por','',$user)<=0)throw new RuntimeException('Collection update failed');
  }
  $note=($r['note_private']??'')."\n".($action==='listo'?'Listo para recoger: ':'Retirado en tienda: ').$eventDate.($recipient?' · Retiró: '.$recipient:'').' · Registrado por: '.$user->login.' · '.date('c')."\nportal-pickup-v1:$nonce:$hash";
  if($action==='retiro')$note.="\nportal-delivery-v1:$nonce:$hash";
  if($order->update_note($note,'_private',1)<=0)throw new RuntimeException('Pickup audit failed');
  portalDeliveryNotification($order,$action==='listo'?'listo_recojo':'retirado',$nonce,$eventDate);
 }
 if(!$db->commit())throw new RuntimeException('Pickup commit failed');$db->query("SELECT RELEASE_LOCK('".$db->escape($lock)."')");$lock=null;
 while(ob_get_level())ob_end_clean();echo json_encode(['ok'=>true,'repetido'=>(bool)$repeated,'pedido'=>['id'=>$id,'ref'=>$r['ref']]],JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){if($pickupDb){$pickupDb->query('ROLLBACK');$pickupDb->transaction_opened=0;if($lock)$pickupDb->query("SELECT RELEASE_LOCK('".$pickupDb->escape($lock)."')");}while(ob_get_level())ob_end_clean();if(!$e instanceof PickupInputError)error_log('Pickup failed: '.$e->getMessage());echo json_encode(['ok'=>false,'status'=>$e instanceof PickupInputError?$e->getCode():503,'error'=>$e instanceof PickupInputError?$e->getMessage():'No se pudo confirmar el cambio. Reintenta el mismo envío.','revisable'=>$e instanceof PickupInputError]);}
