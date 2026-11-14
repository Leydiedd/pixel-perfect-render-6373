<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$identity=storeIdentity($input['userId']??0);if($identity['sesion']['rol']!=='admin')throw new StoreError('Acceso reservado a administración.',403);
require_once __DIR__.'/product-view.php';
$issues=[];$groups=[];$customers=storeRows("SELECT rowid,nom,email,siren,siret,phone,address,town,note_private FROM {$p}societe WHERE entity=$entity AND client IN(1,3) AND status=1");
$add=function($type,$id,$name,$reason,$level='pendiente')use(&$issues){$issues[]=['tipo'=>$type,'id'=>(int)$id,'nombre'=>$name,'problema'=>$reason,'nivel'=>$level,'ruta'=>$type==='producto'?'product/card.php?id='.(int)$id:'societe/card.php?socid='.(int)$id];};
foreach($customers as $c){$meta=storeMeta($c->note_private);$b2c=($meta['canal']??'')==='b2c';$doc=preg_replace('/[\s.-]/','',trim($c->siren?:$c->siret?:''));
 if(!preg_match($b2c?'/^(\d{8}|\d{11})$/':'/^\d{11}$/',$doc)||preg_match('/^(\d)\1+$/',$doc))$add('cliente',$c->rowid,$c->nom,$b2c?'DNI/RUC ausente o formato incompleto':'RUC ausente o formato incompleto');
 foreach(['email'=>'Correo','phone'=>'Teléfono','address'=>'Dirección','town'=>'Ciudad'] as $key=>$label)if(!trim($c->$key??'')||($key==='email'&&!filter_var($c->$key,FILTER_VALIDATE_EMAIL)))$add('cliente',$c->rowid,$c->nom,$label.' ausente o inválido');
 $keys=['documento'=>$doc,'correo'=>mb_strtolower(trim($c->email??'')),'nombre'=>preg_replace('/\s+/u',' ',mb_strtolower(trim($c->nom)))];foreach($keys as $kind=>$value)if($value!=='')$groups[$kind.':'.$value][]=$c;
}
foreach($groups as $key=>$members)if(count($members)>1)foreach($members as $c)$add('cliente',$c->rowid,$c->nom,'Posible duplicado por '.explode(':',$key,2)[0].': coincide con '.implode(', ',array_map(fn($v)=>'#'.$v->rowid,array_filter($members,fn($v)=>$v->rowid!==$c->rowid))),'duplicado');
$products=storeRows("SELECT rowid FROM {$p}product WHERE entity=$entity AND tosell=1 AND fk_product_type=0");$normal=new Societe($db);$normal->price_level=1;$normal->country_id=$mysoc->country_id;$normal->country_code=$mysoc->country_code;$normal->tva_assuj=1;$wholesale=clone $normal;$wholesale->price_level=2;
foreach($products as $row){$pr=new Product($db);if($pr->fetch((int)$row->rowid)<=0)continue;$info=portalProductInfo($pr);foreach(['presentacion'=>'Presentación','peso'=>'Peso','foto'=>'Foto','tipoEnvase'=>'Tipo de envase','unidadesEnvase'=>'Unidades por envase'] as $key=>$label)if(!$info[$key])$add('producto',$pr->id,$pr->label,$label.' sin registrar');foreach([['B2C',$normal],['B2B',$wholesale]] as $rate){$price=portalProductPrice($pr,$rate[1]);if($price['precio']<=0)$add('producto',$pr->id,$pr->label,'Precio '.$rate[0].' ausente o cero');}}
storeReply(['ok'=>true,'clientes'=>count($customers),'productos'=>count($products),'incidencias'=>$issues,'consultadoEn'=>gmdate('c')]);
