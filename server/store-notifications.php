<?php
// Included after native initialization by the private CLI store adapter.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$identity=storeIdentity($input['userId']??0);
if($identity['sesion']['rol']!=='cliente')throw new StoreError('Inicia sesión como cliente.',403);
$customer=(int)$identity['sesion']['clienteId'];$uid=(int)$identity['sesion']['id'];
$ownership="n.entity=$entity AND n.fk_soc=$customer AND o.entity=$entity AND o.fk_soc=$customer";
if($mode==='notifications'){
 $before=$input['before']??null;
 if($before!==null&&(!is_int($before)||$before<=0))throw new StoreError('Página inválida.',400);
 $where=$ownership.($before!==null?' AND n.rowid<'.$before:'');$db->begin();
 $unread=storeRows("SELECT COUNT(*) n FROM {$p}bimbo_notification n JOIN {$p}commande o ON o.rowid=n.fk_commande LEFT JOIN {$p}bimbo_notification_read r ON r.fk_notification=n.rowid AND r.fk_user=$uid WHERE $ownership AND r.fk_notification IS NULL")[0]->n;
 $latest=storeRows("SELECT COALESCE(MAX(n.rowid),0) n FROM {$p}bimbo_notification n JOIN {$p}commande o ON o.rowid=n.fk_commande WHERE $ownership")[0]->n;
 $rs=storeRows("SELECT n.rowid,n.fk_commande,o.ref,n.kind,n.event_date,n.previous_date,n.created_at,r.read_at FROM {$p}bimbo_notification n JOIN {$p}commande o ON o.rowid=n.fk_commande LEFT JOIN {$p}bimbo_notification_read r ON r.fk_notification=n.rowid AND r.fk_user=$uid WHERE $where ORDER BY n.rowid DESC LIMIT 26");
 $more=count($rs)>25;if($more)array_pop($rs);$items=[];
 foreach($rs as $r)$items[]=['id'=>(int)$r->rowid,'pedidoId'=>(int)$r->fk_commande,'pedidoRef'=>$r->ref,'tipo'=>$r->kind,'fecha'=>substr($r->event_date,0,10),'anterior'=>$r->previous_date?substr($r->previous_date,0,10):null,'creadaEn'=>str_replace(' ','T',$r->created_at).'Z','leida'=>$r->read_at!==null];
 $db->commit();storeReply(['ok'=>true,'notificaciones'=>$items,'sinLeer'=>(int)$unread,'ultimoId'=>(int)$latest,'antes'=>$more?(int)end($rs)->rowid:null]);exit;
}
$hasIds=array_key_exists('ids',$input);$hasUntil=array_key_exists('hasta',$input);
if($hasIds===$hasUntil)throw new StoreError('Indica qué notificaciones leer.',400);
if($hasIds){
 $ids=$input['ids'];if(!is_array($ids)||!count($ids)||count($ids)>50||count(array_unique($ids))!==count($ids))throw new StoreError('Notificaciones inválidas.',400);
 foreach($ids as $id)if(!is_int($id)||$id<=0)throw new StoreError('Notificaciones inválidas.',400);
 $range='n.rowid IN('.implode(',',$ids).')';
}else{
 if(!is_int($input['hasta'])||$input['hasta']<=0)throw new StoreError('Límite inválido.',400);
 $range='n.rowid<='.$input['hasta'];
}
$db->begin();
if($hasIds){$owned=storeRows("SELECT n.rowid FROM {$p}bimbo_notification n JOIN {$p}commande o ON o.rowid=n.fk_commande WHERE $ownership AND $range FOR UPDATE");if(count($owned)!==count($ids))throw new StoreError('Notificación no encontrada.',404);}
$sql="INSERT INTO {$p}bimbo_notification_read (fk_notification,fk_user,read_at) SELECT n.rowid,$uid,UTC_TIMESTAMP() FROM {$p}bimbo_notification n JOIN {$p}commande o ON o.rowid=n.fk_commande WHERE $ownership AND $range ON DUPLICATE KEY UPDATE read_at=read_at";
if(!$db->query($sql))throw new RuntimeException('Could not mark notifications read');$db->commit();storeReply(['ok'=>true]);exit;
