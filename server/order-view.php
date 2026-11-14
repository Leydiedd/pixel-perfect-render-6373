<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/order-payment-state.php';
function portalPaymentSummary($rows,$entity,$cancelled=false){
 $invoices=[];$total=0;$paid=0;$credits=0;$balance=0;$invalid=false;
 foreach($rows as $obj){$r=(array)$obj;$id=(int)($r['invoice_id']??0);if(!$id||isset($invoices[$id]))continue;
  if((int)$r['invoice_entity']!==$entity||(int)$r['invoice_customer']!==(int)$r['order_customer']){$invalid=true;continue;}
  if((int)$r['type']===2)continue;
  $active=in_array((int)$r['fk_statut'],[1,2],true)&&in_array((int)$r['type'],[0,1,5],true);
  $remaining=max(0,round((float)$r['total_ttc']-(float)$r['paid']-(float)$r['credits'],2));
  $invoices[$id]=['id'=>$id,'ref'=>$r['ref'],'estado'=>(int)$r['fk_statut'],'total'=>(float)$r['total_ttc'],'saldo'=>$remaining];
  if(!$active){$invalid=true;continue;}
  $total+=(float)$r['total_ttc'];$paid+=(float)$r['paid'];$credits+=(float)$r['credits'];$balance+=$remaining;
 }
 $block=orderPaymentBlock(array_map(fn($r)=>(array)$r,$rows),$entity);
 $status=$cancelled?'cancelado':($invalid?'revisar':(!$invoices?'sin_factura':($block===null?'pagado':($balance<=0?'por_conciliar':($paid+$credits>0?'parcial':'pendiente')))));
 return ['estado'=>$status,'total'=>round($total,2),'cobrado'=>round($paid,2),'creditos'=>round($credits,2),'saldo'=>round($balance,2),'facturas'=>array_values($invoices)];
}
function portalOrderDetail($id,$identity){
 global $p,$entity,$currency,$db;
 $scope=$identity['sesion']['rol']==='cliente'?' AND o.fk_soc='.(int)$identity['sesion']['clienteId']:'';
 $o=storeRows("SELECT o.*,s.nom customer,s.phone,s.address,s.town,s.email FROM {$p}commande o JOIN {$p}societe s ON s.rowid=o.fk_soc AND s.entity=$entity WHERE o.entity=$entity AND o.rowid=$id $scope")[0]??null;
 if(!$o)throw new StoreError('Pedido no encontrado.',404);
 $x=storeRows("SELECT * FROM {$p}commande_extrafields WHERE fk_object=$id")[0]??null;
 $meta=storeMeta($o->note_private,'portal-store-v1:');$pickup=($x->bimbo_modalidad??'')==='recojo';
 $lines=[];foreach(storeRows("SELECT d.fk_product,d.qty,d.subprice,d.tva_tx,d.total_ttc,d.label,d.description,p.ref,p.label product_label FROM {$p}commandedet d LEFT JOIN {$p}product p ON p.rowid=d.fk_product WHERE d.fk_commande=$id ORDER BY d.rang,d.rowid") as $l)$lines[]=['productoId'=>(int)$l->fk_product,'sku'=>$l->ref??'','nombre'=>trim(strip_tags($l->product_label?:$l->label?:$l->description?:'Producto')),'cantidad'=>(float)$l->qty,'precio'=>(float)$l->subprice,'impuesto'=>(float)$l->tva_tx,'total'=>(float)$l->total_ttc];
 $pay=portalPaymentSummary(storeRows(orderPaymentSql($p,$entity,$id)),$entity,(int)$o->fk_statut===-1);
 // Date-only native fields are deliberately not presented with an invented clock time.
 $events=[['id'=>'created','tipo'=>'creado','fecha'=>$o->date_creation?gmdate('c',$db->jdate($o->date_creation)):substr($o->date_commande,0,10),'titulo'=>'Pedido creado','detalle'=>$o->ref]];
 $kinds=['programada'=>'Entrega programada','reprogramada'=>'Fecha de entrega modificada','entregada'=>'Pedido entregado','listo_recojo'=>'Listo para recoger','retirado'=>'Pedido retirado'];$seen=[];
 foreach(storeRows("SELECT rowid,kind,event_date,previous_date,created_at FROM {$p}bimbo_notification WHERE entity=$entity AND fk_soc=".(int)$o->fk_soc." AND fk_commande=$id ORDER BY rowid") as $n){$seen[$n->kind]=true;$events[]=['id'=>'notification-'.$n->rowid,'tipo'=>$n->kind,'fecha'=>str_replace(' ','T',$n->created_at).'Z','titulo'=>$kinds[$n->kind]??'Pedido actualizado','detalle'=>($n->previous_date?'Antes: '.substr($n->previous_date,0,10).' · ':'').'Fecha: '.substr($n->event_date,0,10)];}
 if($o->date_livraison&&!isset($seen['programada'])&&!isset($seen['reprogramada']))$events[]=['id'=>'planned','tipo'=>'prevista','fecha'=>null,'titulo'=>'Entrega prevista','detalle'=>substr($o->date_livraison,0,10).' · No consta cuándo se programó'];
 foreach([['listo_recojo',$x->bimbo_listo_recojo??null],[$pickup?'retirado':'entregada',$x->bimbo_fecha_entrega??null]] as $ev)if($ev[1]&&!isset($seen[$ev[0]]))$events[]=['id'=>'native-'.$ev[0],'tipo'=>$ev[0],'fecha'=>substr($ev[1],0,10),'titulo'=>$kinds[$ev[0]],'detalle'=>'Fecha registrada en Dolibarr'];
 $invoiceIds=array_column($pay['facturas'],'id');
 if($invoiceIds){$ids=implode(',',$invoiceIds);
  foreach(storeRows("SELECT pf.rowid allocation,pay.ref,pay.rowid,pay.datep,pay.datec,pf.amount,f.ref invoice,m.libelle FROM {$p}paiement_facture pf JOIN {$p}paiement pay ON pay.rowid=pf.fk_paiement AND pay.entity=$entity JOIN {$p}facture f ON f.rowid=pf.fk_facture AND f.entity=$entity AND f.fk_soc=".(int)$o->fk_soc." LEFT JOIN {$p}c_paiement m ON m.id=pay.fk_paiement WHERE pf.fk_facture IN ($ids)") as $v)$events[]=['id'=>'payment-'.$v->allocation,'tipo'=>'pago','fecha'=>$v->datec?gmdate('c',$db->jdate($v->datec)):substr($v->datep,0,10),'titulo'=>'Pago registrado','detalle'=>'Fecha de pago: '.substr($v->datep,0,10).' · '.$v->invoice.' · '.number_format((float)$v->amount,2,'.','').' '.$currency.' · '.preg_replace('/\s*\(DEMO\)/i','',$v->libelle??'')];
  foreach(storeRows("SELECT ref,note_private FROM {$p}facture WHERE rowid IN ($ids) AND entity=$entity AND fk_soc=".(int)$o->fk_soc) as $f){preg_match_all('/portal-payment-void-v1:([A-Za-z0-9+\/=]+)/',$f->note_private??'',$matches);foreach($matches[1] as $raw){$v=json_decode(base64_decode($raw),true);if(empty($v['pago']['id']))continue;$events[]=['id'=>'void-'.$v['pago']['id'],'tipo'=>'anulacion_pago','fecha'=>$v['fecha']??null,'titulo'=>'Pago anulado','detalle'=>'Pago del '.($v['pago']['fecha']??'fecha no registrada').' · '.$f->ref.' · '.number_format((float)$v['pago']['importe'],2,'.','').' '.$currency];if(!empty($v['pago']['fechaRegistro']))$events[]=['id'=>'void-original-'.$v['pago']['id'],'tipo'=>'pago_anulado','fecha'=>$v['pago']['fechaRegistro']??null,'titulo'=>'Pago registrado (posteriormente anulado)','detalle'=>$f->ref.' · '.number_format((float)$v['pago']['importe'],2,'.','').' '.$currency];}}
 }
 usort($events,fn($a,$b)=>strcmp($a['fecha']??'9999',$b['fecha']??'9999'));
 return ['ok'=>true,'id'=>$id,'ref'=>$o->ref,'cliente'=>$o->customer,'modalidad'=>$pickup?'recojo':'delivery','entrega'=>$meta['entrega']??null,'contactoActual'=>['telefono'=>$o->phone,'direccion'=>$o->address,'ciudad'=>$o->town,'correo'=>$o->email],'puntoRecojo'=>$x->bimbo_punto_recojo??null,'recibidoPor'=>$x->bimbo_recibido_por??null,'pago'=>$pay,'lineas'=>$lines,'historial'=>$events,'moneda'=>$currency];
}
