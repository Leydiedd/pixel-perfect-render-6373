<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
function portalProductPhoto($product){
 global $conf;
 require_once DOL_DOCUMENT_ROOT.'/core/lib/files.lib.php';
 $root=realpath($conf->product->multidir_output[$product->entity]??'');if(!$root)return null;
 $sub=getDolGlobalInt('PRODUCT_USE_OLD_PATH_FOR_PHOTO')?get_exdir($product->id,2,0,0,$product,'product').$product->id.'/photos/':get_exdir(0,0,0,0,$product,'product');
 $dir=realpath($root.'/'.$sub);if(!$dir||strncasecmp(str_replace('\\','/',$dir).'/',str_replace('\\','/',$root).'/',strlen($root)+1)!==0)return null;
 $names=scandir($dir);sort($names,SORT_STRING);
 foreach($names as $name){$file=realpath($dir.'/'.$name);if(!$file||!is_file($file)||strncasecmp(str_replace('\\','/',$file),str_replace('\\','/',$dir).'/',strlen($dir)+1)!==0||!preg_match('/\.(png|jpe?g|webp|gif)$/i',$name)||filesize($file)>3000000)continue;$info=@getimagesize($file);if($info&&in_array($info['mime'],['image/png','image/jpeg','image/webp','image/gif'],true))return ['file'=>$file,'mime'=>$info['mime']];}
 return null;
}
function portalProductInfo($product){
 $product->fetch_optionals();$x=$product->array_options??[];
 $presentation=trim(strip_tags($x['options_bimbo_presentacion']??''));
 $unit=$x['options_bimbo_tipo_envase']??'';$units=(int)($x['options_bimbo_unidades_envase']??0);
 $weight=(float)$product->weight;$scales=[-6=>'mg',-3=>'g',0=>'kg',3=>'t'];$scale=(int)$product->weight_units;
 return ['presentacion'=>$presentation?:null,'peso'=>$weight>0&&isset($scales[$scale])?$weight.' '.$scales[$scale]:null,'tipoEnvase'=>in_array($unit,['paquete','caja'],true)?$unit:null,'unidadesEnvase'=>$units>0?$units:null,'foto'=>portalProductPhoto($product)?'/api/producto-foto?id='.(int)$product->id:null];
}
