<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');ob_start();$planDb=null;$lock=null;
require_once __DIR__.'/delivery-state.php';
require_once __DIR__.'/delivery-notifications.php';
class PlanInputError extends RuntimeException{}
function planCheck($ok,$message,$status=409){if(!$ok)throw new PlanInputError($message,$status);}
function planRows($sql){global $db;$r=$db->query($sql);if(!$r)throw new RuntimeException('Plan query failed');$out=[];while($row=$db->fetch_array($r))$out[]=$row;return $out;}
try{
 $raw=stream_get_contents(STDIN,8193);planCheck(strlen($raw)<=8192,'Solicitud demasiado grande.',400);$input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
 $keys=array_keys($input);sort($keys);planCheck($keys===['anterior','fecha','pedidoId','solicitudId','usuarioId'],'Solicitud inválida.',400);
 planCheck(is_int($input['pedidoId'])&&$input['pedidoId']>0&&is_int($input['usuarioId'])&&$input['usuarioId']>0,'Pedido o usuario inválido.',400);
 planCheck(is_string($input['solicitudId'])&&preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i',$input['solicitudId']),'Solicitud inválida.',400);
 $date=is_string($input['fecha'])?DateTimeImmutable::createFromFormat('!Y-m-d',$input['fecha'],new DateTimeZone('America/Lima')):false;
 planCheck($date&&$date->format('Y-m-d')===$input['fecha']&&$input['fecha']>='1000-01-01','Indica una fecha válida.',400);
 planCheck($input['anterior']===null||(is_string($input['anterior'])&&preg_match('/^\d{4}-\d{2}-\d{2}$/',$input['anterior'])),'Fecha anterior inválida.',400);
 require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?:1);require_once $dolibarr_main_document_root.'/master.inc.php';require_once DOL_DOCUMENT_ROOT.'/commande/class/commande.class.php';$planDb=$db;
 planCheck($user->fetch($input['usuarioId'])>0&&$user->admin&&$user->statut&&!$user->socid&&!$user->isNotIntoValidityDateRange()&&!$user->force_pass_change,'Acceso reservado a administración.',403);
 $user->loadRights();planCheck($user->hasRight('commande','creer'),'Falta permiso para editar pedidos.',403);
 $p=MAIN_DB_PREFIX;$entity=(int)$conf->entity;$id=$input['pedidoId'];$nonce=strtolower($input['solicitudId']);$hash=hash('sha256',json_encode([$id,$input['fecha'],$input['anterior'],$input['usuarioId']]));
 planCheck(deliveryFieldsExist('planRows',$p),'Configura los campos de entrega en Dolibarr.',503);
 $lock='bimbo-orders-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,40);planCheck((int)planRows("SELECT GET_LOCK('".$db->escape($lock)."',10) n")[0]['n']===1,'Hay otra operación en curso. Reintenta.');$db->begin();
 $rs=planRows("SELECT rowid,ref,date_commande,date_livraison,fk_statut,note_private FROM {$p}commande WHERE rowid=$id AND entity=$entity FOR UPDATE");planCheck(count($rs)===1,'Pedido no encontrado.',404);$r=$rs[0];$current=$r['date_livraison']?substr($r['date_livraison'],0,10):null;
 $actual=planRows("SELECT bimbo_fecha_entrega FROM {$p}commande_extrafields WHERE fk_object=$id FOR UPDATE");
 planCheck(!planRows("SELECT fk_object FROM {$p}commande_extrafields WHERE fk_object=$id AND bimbo_modalidad='recojo'"),'Este pedido es para recojo en tienda. Usa las acciones de recojo.');
 $repeated=preg_match('/(?:^|\n)portal-delivery-plan-v1:'.preg_quote($nonce,'/').':([a-f0-9]{64})(?=\s|$)/',$r['note_private']??'',$matches);
 if($repeated){planCheck(hash_equals($matches[1],$hash)&&$current===$input['fecha'],'La fecha ya fue modificada o el reintento tiene otro contenido. Actualiza el listado.');}
 else{
  planCheck(in_array((int)$r['fk_statut'],[0,1,2,3],true),'No se puede programar un pedido cancelado.');
  planCheck(empty($actual[0]['bimbo_fecha_entrega'])&&!str_contains($r['note_private']??'','portal-delivery-v1:'),'La recepción ya está confirmada. No se puede cambiar la fecha prevista.');
  planCheck($current===$input['anterior'],'Otro administrador cambió la fecha prevista. Cierra este formulario y vuelve a abrirlo para revisar la fecha actual.');
  planCheck($input['fecha']>=substr($r['date_commande'],0,10),'La fecha prevista no puede ser anterior al pedido.');
  $order=new Commande($db);if($order->fetch($id)<=0)throw new RuntimeException('Order fetch failed');
  $timestamp=dol_mktime(12,0,0,(int)$date->format('m'),(int)$date->format('d'),(int)$date->format('Y'));
  if($order->setDeliveryDate($user,$timestamp)<=0)throw new RuntimeException('Native planned date update failed');
  $note=($r['note_private']??'')."\nFecha prevista de entrega: ".($current??'Sin fecha').' → '.$input['fecha'].' · Registrado por: '.$user->login.' · '.date('c')."\nportal-delivery-plan-v1:$nonce:$hash";
  if($order->update_note($note,'_private',1)<=0)throw new RuntimeException('Plan audit failed');
  $saved=planRows("SELECT date_livraison FROM {$p}commande WHERE rowid=$id")[0];if(substr($saved['date_livraison']??'',0,10)!==$input['fecha'])throw new RuntimeException('Plan persistence mismatch');
  if($current!==$input['fecha'])portalDeliveryNotification($order,$current===null?'programada':'reprogramada',$nonce,$input['fecha'],$current);
 }
 if(!$db->commit())throw new RuntimeException('Plan commit failed');$db->query("SELECT RELEASE_LOCK('".$db->escape($lock)."')");$lock=null;
 while(ob_get_level())ob_end_clean();echo json_encode(['ok'=>true,'repetido'=>(bool)$repeated,'pedido'=>['id'=>$id,'ref'=>$r['ref'],'fechaPrevista'=>$input['fecha']]],JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){if($planDb){$planDb->query('ROLLBACK');$planDb->transaction_opened=0;if($lock)$planDb->query("SELECT RELEASE_LOCK('".$planDb->escape($lock)."')");}while(ob_get_level())ob_end_clean();if(!$e instanceof PlanInputError)error_log('Delivery plan failed: '.$e->getMessage());echo json_encode(['ok'=>false,'status'=>$e instanceof PlanInputError?$e->getCode():503,'error'=>$e instanceof PlanInputError?$e->getMessage():'No se pudo confirmar el guardado. Reintenta el mismo envío.','revisable'=>$e instanceof PlanInputError]);}
