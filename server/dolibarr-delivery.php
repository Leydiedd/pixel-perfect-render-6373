<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');ob_start();$deliveryDb=null;$lock=null;
require_once __DIR__.'/delivery-state.php';
require_once __DIR__.'/order-payment-state.php';
require_once __DIR__.'/delivery-notifications.php';
class DeliveryInputError extends RuntimeException{}
function deliveryRows($sql){global $db;$res=$db->query($sql);if(!$res)throw new RuntimeException('Delivery query failed');$out=[];while($r=$db->fetch_array($res))$out[]=$r;return $out;}
function deliveryCheck($condition,$message,$status=409){if(!$condition)throw new DeliveryInputError($message,$status);}
try{
 $raw=stream_get_contents(STDIN,8193);deliveryCheck(strlen($raw)<=8192,'Solicitud demasiado grande.',400);$input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
 $keys=array_keys($input);sort($keys);deliveryCheck($keys===['fecha','pedidoId','receptor','solicitudId','usuarioId'],'Solicitud inválida.',400);
 deliveryCheck(is_int($input['pedidoId'])&&$input['pedidoId']>0&&is_int($input['usuarioId'])&&$input['usuarioId']>0,'Pedido o usuario inválido.',400);
 deliveryCheck(is_string($input['solicitudId'])&&preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i',$input['solicitudId']),'Solicitud inválida.',400);
 deliveryCheck(is_string($input['receptor'])&&mb_strlen(trim($input['receptor']))>=2&&mb_strlen($input['receptor'])<=128&&!preg_match('/[<>\x00-\x1f]/',$input['receptor']),'Indica quién recibió el pedido (2 a 128 caracteres).',400);
 $date=is_string($input['fecha'])?DateTimeImmutable::createFromFormat('!Y-m-d',$input['fecha'],new DateTimeZone('America/Lima')):false;
 deliveryCheck($date&&$date->format('Y-m-d')===$input['fecha']&&$input['fecha']<=(new DateTimeImmutable('now',new DateTimeZone('America/Lima')))->format('Y-m-d'),'La fecha debe ser válida y no puede estar en el futuro.',400);
 require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?:1);require_once $dolibarr_main_document_root.'/master.inc.php';require_once DOL_DOCUMENT_ROOT.'/commande/class/commande.class.php';$deliveryDb=$db;
 deliveryCheck($user->fetch($input['usuarioId'])>0&&$user->admin&&$user->statut&&!$user->socid&&!$user->isNotIntoValidityDateRange()&&!$user->force_pass_change,'Acceso reservado a administración.',403);$user->loadRights();deliveryCheck($user->hasRight('commande','creer'),'Falta permiso para editar pedidos.',403);
 $entity=(int)$conf->entity;$p=MAIN_DB_PREFIX;$id=$input['pedidoId'];$nonce=strtolower($input['solicitudId']);$recipient=trim($input['receptor']);$hash=hash('sha256',json_encode([$id,$input['fecha'],$recipient,$input['usuarioId']]));
 deliveryCheck(deliveryFieldsExist('deliveryRows',$p),'Configura los campos de entrega en Dolibarr.',503);
 $lock='bimbo-orders-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,40);deliveryCheck((int)deliveryRows("SELECT GET_LOCK('".$db->escape($lock)."',10) n")[0]['n']===1,'Hay otra operación en curso. Reintenta.');$db->begin();
 $orders=deliveryRows("SELECT rowid,ref,date_commande,fk_statut,note_private FROM {$p}commande WHERE rowid=$id AND entity=$entity FOR UPDATE");deliveryCheck(count($orders)===1,'Pedido no encontrado.',404);$row=$orders[0];
 deliveryRows("SELECT rowid FROM {$p}commandedet WHERE fk_commande=$id FOR UPDATE");
 deliveryRows("SELECT e.rowid FROM {$p}expedition e JOIN {$p}expeditiondet ed ON ed.fk_expedition=e.rowid JOIN {$p}commandedet d ON d.rowid=ed.fk_elementdet AND ed.element_type='commande' WHERE d.fk_commande=$id AND e.entity=$entity FOR UPDATE");
 $existing=deliveryRows("SELECT bimbo_fecha_entrega,bimbo_recibido_por FROM {$p}commande_extrafields WHERE fk_object=$id FOR UPDATE");
 deliveryCheck(!deliveryRows("SELECT fk_object FROM {$p}commande_extrafields WHERE fk_object=$id AND bimbo_modalidad='recojo'"),'Este pedido es para recojo en tienda. Usa las acciones de recojo.');
 $actual=$existing[0]['bimbo_fecha_entrega']??null;$receiver=$existing[0]['bimbo_recibido_por']??null;
 $hasAudit=preg_match('/(?:^|\n)portal-delivery-v1:'.preg_quote($nonce,'/').':([a-f0-9]{64})(?=\s|$)/',$row['note_private']??'',$m);
 deliveryCheck(in_array((int)$row['fk_statut'],[1,2,3],true),'Solo se pueden entregar pedidos validados que no estén cancelados.');
 if($hasAudit){deliveryCheck(hash_equals($m[1],$hash)&&substr($actual??'',0,10)===$input['fecha']&&$receiver===$recipient,'La entrega ya fue modificada o este envío tiene otro contenido. Revisa el pedido.');}
 else{
  deliveryCheck(!$actual,'Este pedido ya tiene una entrega confirmada. Actualiza el listado.');
  deliveryCheck(!str_contains($row['note_private']??'','portal-delivery-v1:'),'La confirmación anterior fue modificada. Revisa el pedido en Dolibarr.');
  $paymentBlock=lockedOrderPaymentBlock('deliveryRows',$p,$entity,$id);deliveryCheck($paymentBlock===null,$paymentBlock??'');
  $coverage=deliveryRows(deliveryCoverageSql($p,$entity,$id));deliveryCheck(deliveryEligible($coverage),'Las expediciones validadas deben cubrir todas las líneas del pedido.');
  $earliest=substr($row['date_commande'],0,10);foreach($coverage as $line)$earliest=max($earliest,substr($line['last_shipped'],0,10));deliveryCheck($input['fecha']>=$earliest,'La entrega no puede ser anterior al pedido o a la última expedición.');
  $order=new Commande($db);if($order->fetch($id)<=0)throw new RuntimeException('Fetch failed');
  $order->array_options['options_bimbo_fecha_entrega']=dol_mktime(12,0,0,(int)$date->format('m'),(int)$date->format('d'),(int)$date->format('Y'));
  $order->array_options['options_bimbo_recibido_por']=$recipient;
  if($order->updateExtraField('bimbo_fecha_entrega','',$user)<=0||$order->updateExtraField('bimbo_recibido_por','',$user)<=0)throw new RuntimeException('Native delivery update failed');
  $note=($row['note_private']??'')."\nEntrega confirmada: ".$input['fecha'].' · Recibido por: '.$recipient.' · Registrado por: '.$user->login.' · '.date('c')."\nportal-delivery-v1:$nonce:$hash";
  if($order->update_note($note,'_private',1)<=0)throw new RuntimeException('Audit failed');
  $saved=deliveryRows("SELECT bimbo_fecha_entrega,bimbo_recibido_por FROM {$p}commande_extrafields WHERE fk_object=$id")[0];if(substr($saved['bimbo_fecha_entrega'],0,10)!==$input['fecha']||$saved['bimbo_recibido_por']!==$recipient)throw new RuntimeException('Delivery persistence mismatch');
  portalDeliveryNotification($order,'entregada',$nonce,$input['fecha']);
 }
 if(!$db->commit())throw new RuntimeException('Commit failed');$db->query("SELECT RELEASE_LOCK('".$db->escape($lock)."')");$lock=null;
 while(ob_get_level())ob_end_clean();echo json_encode(['ok'=>true,'repetido'=>(bool)$hasAudit,'pedido'=>['id'=>$id,'ref'=>$row['ref'],'fechaEntrega'=>$input['fecha'],'receptor'=>$recipient]],JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){if($deliveryDb){$deliveryDb->query('ROLLBACK');$deliveryDb->transaction_opened=0;if($lock)$deliveryDb->query("SELECT RELEASE_LOCK('".$deliveryDb->escape($lock)."')");}while(ob_get_level())ob_end_clean();if(!$e instanceof DeliveryInputError)error_log('Delivery confirmation failed: '.$e->getMessage());echo json_encode(['ok'=>false,'status'=>$e instanceof DeliveryInputError?$e->getCode():503,'error'=>$e instanceof DeliveryInputError?$e->getMessage():'No se pudo confirmar la entrega. Reintenta el mismo envío para recuperar el resultado.','revisable'=>$e instanceof DeliveryInputError]);}
