<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');
require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
if(($argv[1]??'')!=='--apply'||($argv[2]??'')!==$dolibarr_main_db_name){fwrite(STDERR,"Use --apply EXACT_DATABASE\n");exit(1);}
$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?:1);require_once $dolibarr_main_document_root.'/master.inc.php';require_once DOL_DOCUMENT_ROOT.'/core/class/extrafields.class.php';
try{
 if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?:1))<=0||!$user->admin||!$user->statut||$user->socid)throw new RuntimeException('Administrator required');
 $extra=new ExtraFields($db);$extra->fetch_name_optionals_label('commande');
 foreach(['bimbo_fecha_entrega'=>['Fecha real de entrega','date',''],'bimbo_recibido_por'=>['Recibido por','varchar','128']] as $name=>$field){
  if(isset($extra->attributes['commande']['type'][$name])){if($extra->attributes['commande']['type'][$name]!==$field[1])throw new RuntimeException('Existing field type differs');continue;}
  if($extra->addExtraField($name,$field[0],$field[1],100,$field[2],'commande',0,0,'','',1,'','1','Confirmación de recepción del cliente, independiente de la salida de almacén.','',(int)$conf->entity,'','1',0,0,[],'',1)<=0)throw new RuntimeException('Could not create delivery field: '.$extra->error);
 }
 echo "Delivery fields configured; existing orders unchanged\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
