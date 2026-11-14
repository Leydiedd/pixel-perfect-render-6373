<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');
require getenv('DOLIBARR_CONFIG_PATH')?:'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
if(($argv[1]??'')!=='--apply'||($argv[2]??'')!==$dolibarr_main_db_name){fwrite(STDERR,"Use --apply EXACT_DATABASE\n");exit(1);}
$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY')?:1);require_once $dolibarr_main_document_root.'/master.inc.php';require_once DOL_DOCUMENT_ROOT.'/core/class/extrafields.class.php';
$extra=new ExtraFields($db);$extra->fetch_name_optionals_label('product');
foreach(['bimbo_presentacion'=>['Presentación comercial','varchar','255'],'bimbo_tipo_envase'=>['Envase de venta','select',''],'bimbo_unidades_envase'=>['Unidades dentro del envase de venta','int','10']] as $name=>$f){
 if(isset($extra->attributes['product']['type'][$name])){if($extra->attributes['product']['type'][$name]!==$f[1])throw new RuntimeException('Field type differs');continue;}
 if($extra->addExtraField($name,$f[0],$f[1],100,$f[2],'product',0,0,'',$name==='bimbo_tipo_envase'?['options'=>['paquete'=>'Paquete','caja'=>'Caja']]:'',1,'','1','Ficha comercial de la tienda; no modifica stock ni precios.','',(int)$conf->entity,'','1',0,0,[],'',1)<=0)throw new RuntimeException('Product field creation failed');
}
echo "Product information fields configured; existing product values unchanged\n";
