<?php
// CLI-only, read-only adapter. Never place this file in a public web directory.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors','0');
ini_set('zend.exception_ignore_args','1');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
set_exception_handler(function($e) { fwrite(STDERR,"Dolibarr no disponible. Comprueba la configuración local y MySQL.\n"); exit(1); });
$config=getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
if(!is_file($config)) throw new RuntimeException('Configuration missing');
require $config;
$entity=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
if($entity<1 || !preg_match('/^[a-zA-Z0-9_]+$/',$dolibarr_main_db_prefix)) throw new RuntimeException('Invalid configuration');
$db=new mysqli($dolibarr_main_db_host,$dolibarr_main_db_user,$dolibarr_main_db_pass,$dolibarr_main_db_name,(int)$dolibarr_main_db_port ?: 3306);
$db->set_charset('utf8mb4');
$db->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
function queryRows($sql) {global $db,$dolibarr_main_db_prefix;return $db->query(str_replace('llx_',$dolibarr_main_db_prefix,$sql))->fetch_all(MYSQLI_ASSOC);}
require_once __DIR__.'/sales-channel.php';
require_once __DIR__.'/delivery-state.php';
require_once __DIR__.'/order-payment-state.php';
require_once __DIR__.'/admin-payment-report.php';
function reportOrigin($r){return str_starts_with($r['import_key']??'','AC261113')?'academico':(str_starts_with($r['ref_ext']??'','WEB-')?'portal':'historico');}
function num($v){return $v===null ? null : (float)$v;}
function day($v){return $v ? substr($v,0,10) : null;}
function plain($v){return trim(html_entity_decode(strip_tags($v ?? ''),ENT_QUOTES | ENT_HTML5,'UTF-8'));}
function storeOrderMeta($note) {
 if(preg_match('/portal-store-v1:([A-Za-z0-9+\/=]+)/',$note ?? '',$m)) return json_decode(base64_decode($m[1]),true) ?: [];
 return [];
}
function storeOrderAddress($note) {
 $m=storeOrderMeta($note); $e=$m['entrega'] ?? [];
 return $e ? implode(' · ',array_map('plain',array_intersect_key($e,array_flip(['contacto','telefono','direccion','ciudad'])))) : null;
}
function documentPath($relative) {
 global $dolibarr_main_data_root;
 if(!$relative || str_contains($relative,"\0")) return null;
 $root=realpath($dolibarr_main_data_root);$file=realpath($dolibarr_main_data_root.'/'.$relative);
 if(!$root || !$file || !is_file($file)) return null;
 $prefix=str_replace('\\','/',$root).'/';$normalized=str_replace('\\','/',$file);
 if(strncasecmp($normalized,$prefix,strlen($prefix))!==0 || strtolower(pathinfo($file,PATHINFO_EXTENSION))!=='pdf') return null;
 return $file;
}
function invoiceDocumentPath($invoice) {
 if((int)$invoice['fk_statut']===3) return null;
 $stored=documentPath($invoice['last_main_doc']);
 if($stored) return $stored;
 // Imported backups can retain paths from another installation. Resolve only
 // the exact invoice reference in the restored invoice directory, never a glob.
 $ref=$invoice['ref'];
 if(!preg_match('/^[a-zA-Z0-9_-]+$/D',$ref)) return null;
 return documentPath('facture/'.$ref.'/'.$ref.'.pdf');
}
$paymentNames=['LIQ'=>'Efectivo','VIR'=>'Transferencia bancaria','CB'=>'Tarjeta','CHQ'=>'Cheque','PRE'=>'Domiciliación'];
$mode=$argv[1] ?? 'snapshot';
$scope=(int)(getenv('DOLIBARR_CUSTOMER_ID') ?: 0);
if($scope && $mode!=='document') throw new RuntimeException('Invalid customer scope');
if($mode==='history') {
 require_once __DIR__.'/dolibarr-payment-void-common.php';
 $id=$argv[2] ?? '';
 if(!preg_match('/^[1-9][0-9]{0,9}$/D',$id)) {echo json_encode(['error'=>'Factura inválida']);exit;}
 $id=(int)$id;
 $hasAccounting=(bool)queryRows("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='llx_accounting_bookkeeping'");
 $accounted=$hasAccounting ? "(SELECT COUNT(*) FROM llx_accounting_bookkeeping bk WHERE bk.doc_type='customer_invoice' AND bk.fk_doc=f.rowid)" : '0';
 $f=queryRows("SELECT f.rowid,f.ref,f.type,f.multicurrency_code,f.note_private,f.fk_statut,f.paye,f.total_ttc,f.last_main_doc,s.nom,$accounted accounted FROM llx_facture f LEFT JOIN llx_societe s ON s.rowid=f.fk_soc WHERE f.entity=$entity AND f.rowid=$id")[0] ?? null;
 if(!$f) {echo json_encode(['error'=>'Factura no encontrada']);exit;}
 $currency=queryRows("SELECT value FROM llx_const WHERE name='MAIN_MONNAIE' AND entity IN (0,$entity) ORDER BY entity DESC LIMIT 1")[0]['value'] ?? 'PEN';
 $payments=[];
 // pf.amount is the part assigned to THIS invoice. A single payment may cover several.
 foreach(queryRows(voidPaymentSql($dolibarr_main_db_prefix,$entity,$id,$hasAccounting)) as $r) {
  $blocked=voidPaymentReason($r,$f,$currency);
  $payments[]=['id'=>(int)$r['rowid'],'ref'=>$r['ref'] ?: 'Pago #'.$r['rowid'],'fecha'=>day($r['datep']),'importe'=>(float)$r['applied'],'demostracion'=>adminPaymentIsDemo($r),'medio'=>adminPaymentMethod($r),'cuenta'=>$r['label'] ?: null,'referencia'=>$r['num_paiement'] ?: null,'anulable'=>$blocked===null,'bloqueo'=>$blocked,'huella'=>voidPaymentFingerprint($r)];
 }
 $received=round(array_sum(array_column($payments,'importe')),2);
 $credits=(float)(queryRows("SELECT COALESCE(SUM(rc.amount_ttc),0) amount FROM llx_societe_remise_except rc JOIN llx_facture source ON source.rowid=rc.fk_facture_source AND source.entity=$entity WHERE rc.fk_facture=$id AND source.type IN (0,2,3,5)")[0]['amount']);
 $balance=(int)$f['fk_statut']===1 && !$f['paye'] ? max(0,round((float)$f['total_ttc']-$received-$credits,2)) : 0;
 $annulled=[];
 foreach(array_reverse(voidPaymentAudit($f['note_private'])) as $entry) $annulled[]=['id'=>(int)$entry['pago']['id'],'ref'=>$entry['pago']['ref'],'importe'=>(float)$entry['pago']['importe'],'fecha'=>$entry['fecha'],'motivo'=>$entry['motivo'],'usuario'=>$entry['usuario'],'medio'=>$entry['pago']['medio'] ?? null,'demostracion'=>$entry['pago']['demostracion'] ?? null];
 $db->commit();
 echo json_encode(['factura'=>['id'=>$id,'ref'=>$f['ref'],'cliente'=>$f['nom'] ?? 'Sin tercero','estado'=>(int)$f['fk_statut'],'pagada'=>(bool)$f['paye'],'total'=>(float)$f['total_ttc'],'cobrado'=>$received,'creditos'=>$credits,'saldo'=>$balance,'moneda'=>$currency,'pdf'=>invoiceDocumentPath($f)!==null],'pagos'=>$payments,'anulados'=>$annulled],JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);exit;
}
if($mode==='document') {
 $id=$argv[2] ?? '';
 if(!ctype_digit($id) || (int)$id<1) {echo json_encode(['error'=>'Documento inválido']);exit;}
 $r=queryRows('SELECT ref,last_main_doc,fk_statut FROM llx_facture WHERE entity='.$entity.' AND rowid='.(int)$id.($scope ? ' AND fk_soc='.$scope : ''))[0] ?? null;
 $file=$r ? invoiceDocumentPath($r) : null;
 if(!$file) {echo json_encode(['error'=>'PDF no disponible']);exit;}
 if(filesize($file)>15000000) throw new RuntimeException('Document exceeds limit');
 echo json_encode(['filename'=>preg_replace('/[^a-zA-Z0-9._-]/','_',$r['ref']).'.pdf','base64'=>base64_encode(file_get_contents($file))]);exit;
}
if($mode!=='snapshot') throw new RuntimeException('Invalid operation');
$constants=[];
foreach(queryRows("SELECT name,value FROM llx_const WHERE entity IN (0,$entity) AND name IN ('MAIN_INFO_SOCIETE_NOM','MAIN_INFO_SOCIETE_TEL','MAIN_INFO_SOCIETE_MAIL','MAIN_INFO_SOCIETE_ADDRESS','MAIN_INFO_SOCIETE_TOWN','MAIN_MONNAIE','STOCK_SUPPORTS_SERVICES') ORDER BY entity") as $r) $constants[$r['name']]=$r['value'];
$categories=[];
foreach(queryRows("SELECT cp.fk_product,c.label FROM llx_categorie_product cp JOIN llx_categorie c ON c.rowid=cp.fk_categorie WHERE c.entity=$entity AND c.type=0 ORDER BY c.label") as $r) $categories[$r['fk_product']][]=$r['label'];
$stock=[];
foreach(queryRows("SELECT ps.fk_product,e.rowid,e.ref,ps.reel FROM llx_product_stock ps JOIN llx_entrepot e ON e.rowid=ps.fk_entrepot WHERE e.entity=$entity ORDER BY e.ref") as $r) $stock[$r['fk_product']][]=['id'=>(int)$r['rowid'],'nombre'=>$r['ref'],'cantidad'=>(float)$r['reel']];
$batches=[];
foreach(queryRows("SELECT ps.fk_product,b.batch,b.qty,COALESCE(l.eatby,b.eatby) eatby,COALESCE(l.sellby,b.sellby) sellby,e.ref FROM llx_product_batch b JOIN llx_product_stock ps ON ps.rowid=b.fk_product_stock LEFT JOIN llx_product_lot l ON l.fk_product=ps.fk_product AND l.batch=b.batch AND l.entity=$entity JOIN llx_entrepot e ON e.rowid=ps.fk_entrepot WHERE e.entity=$entity") as $r) $batches[$r['fk_product']][]=['lote'=>$r['batch'],'cantidad'=>(float)$r['qty'],'caducidad'=>day($r['eatby']),'ventaHasta'=>day($r['sellby']),'almacen'=>$r['ref']];
$products=[];
foreach(queryRows("SELECT p.rowid,p.ref,p.label,p.description,p.price,p.price_ttc,p.tva_tx,p.seuil_stock_alerte,p.tosell,p.fk_product_type,p.stockable_product,u.short_label FROM llx_product p LEFT JOIN llx_c_units u ON u.rowid=p.fk_unit WHERE p.entity=$entity ORDER BY p.ref") as $r) {
 $stocks=$stock[$r['rowid']] ?? [];
 $products[]=['id'=>(int)$r['rowid'],'sku'=>$r['ref'],'nombre'=>$r['label'],'descripcion'=>plain($r['description']),'categorias'=>$categories[$r['rowid']] ?? [],'precio'=>num($r['price']),'precioConImpuesto'=>num($r['price_ttc']),'impuesto'=>num($r['tva_tx']),'stock'=>array_sum(array_column($stocks,'cantidad')),'umbral'=>num($r['seuil_stock_alerte']),'unidad'=>$r['short_label'],'enVenta'=>(bool)$r['tosell'],'tipo'=>(int)$r['fk_product_type'],'gestionaStock'=>((int)$r['fk_product_type'] === 0 || ((int)$r['fk_product_type'] === 1 && !empty($constants['STOCK_SUPPORTS_SERVICES']))) && (int)$r['stockable_product'] > 0,'almacenes'=>$stocks,'lotes'=>$batches[$r['rowid']] ?? []];
}
$paidAmounts=[];$creditAmounts=[];
foreach(queryRows("SELECT pf.fk_facture,SUM(pf.amount) amount FROM llx_paiement_facture pf JOIN llx_facture f ON f.rowid=pf.fk_facture WHERE f.entity=$entity GROUP BY pf.fk_facture") as $r) $paidAmounts[$r['fk_facture']]=(float)$r['amount'];
foreach(queryRows("SELECT rc.fk_facture,SUM(rc.amount_ttc) amount FROM llx_societe_remise_except rc JOIN llx_facture source ON source.rowid=rc.fk_facture_source JOIN llx_facture target ON target.rowid=rc.fk_facture WHERE target.entity=$entity AND source.type IN (0,2,3,5) GROUP BY rc.fk_facture") as $r) $creditAmounts[$r['fk_facture']]=(float)$r['amount'];
$paymentSummaries=[];
foreach(queryRows("SELECT pf.fk_facture,pf.amount,p.note,m.code,m.libelle,a.ref account_ref FROM llx_paiement_facture pf JOIN llx_facture f ON f.rowid=pf.fk_facture AND f.entity=$entity JOIN llx_paiement p ON p.rowid=pf.fk_paiement AND p.entity=$entity LEFT JOIN llx_c_paiement m ON m.id=p.fk_paiement LEFT JOIN llx_bank b ON b.rowid=p.fk_bank LEFT JOIN llx_bank_account a ON a.rowid=b.fk_account AND a.entity=$entity ORDER BY p.datep DESC,p.rowid DESC") as $r) {
 $demo=adminPaymentIsDemo($r);$code=adminPaymentMethodCode($r);$key=$code.':'.($demo?'demo':'real');$fid=$r['fk_facture'];
 if(!isset($paymentSummaries[$fid][$key])) $paymentSummaries[$fid][$key]=['codigo'=>$code,'medio'=>adminPaymentMethod($r),'demostracion'=>$demo,'importe'=>0];
 $paymentSummaries[$fid][$key]['importe']=round($paymentSummaries[$fid][$key]['importe']+(float)$r['amount'],2);
}
$invoiceOrderNotes=[];
foreach(queryRows("SELECT ee.fk_target,o.note_private FROM llx_element_element ee JOIN llx_commande o ON o.rowid=ee.fk_source AND o.entity=$entity JOIN llx_facture f ON f.rowid=ee.fk_target AND f.entity=$entity AND f.fk_soc=o.fk_soc WHERE ee.sourcetype='commande' AND ee.targettype='facture'") as $link) $invoiceOrderNotes[$link['fk_target']][]=$link['note_private'];
$invoices=[];
foreach(queryRows("SELECT f.rowid,f.fk_soc,f.ref,f.ref_ext,f.import_key,f.type,f.datef,f.date_lim_reglement,f.paye,f.fk_statut,f.total_ht,f.total_tva,f.total_ttc,f.last_main_doc,f.multicurrency_code,f.note_private,src.note_private source_note,s.nom,s.note_private customer_note,s.price_level customer_price_level,typ.code customer_type FROM llx_facture f LEFT JOIN llx_societe s ON s.rowid=f.fk_soc AND s.entity=f.entity LEFT JOIN llx_c_typent typ ON typ.id=s.fk_typent LEFT JOIN llx_facture src ON src.rowid=f.fk_facture_source AND src.entity=f.entity AND src.fk_soc=f.fk_soc WHERE f.entity=$entity ORDER BY f.datef DESC,f.rowid DESC") as $r) {
 $received=$paidAmounts[$r['rowid']] ?? 0;
 $balance=(int)$r['fk_statut']===1 && !$r['paye'] ? max(0,round((float)$r['total_ttc']-$received-($creditAmounts[$r['rowid']] ?? 0),2)) : 0;
 $payable=$balance>0 && in_array((int)$r['type'],[0,1],true) && (!$r['multicurrency_code'] || $r['multicurrency_code']===($constants['MAIN_MONNAIE'] ?? 'PEN'));
 $invoices[]=salesChannel($r['note_private'],$r,array_merge([$r['source_note']],$invoiceOrderNotes[$r['rowid']] ?? []))+['origenDatos'=>reportOrigin($r),'clienteId'=>$r['fk_soc'] ? (int)$r['fk_soc'] : null,'pagosResumen'=>array_values($paymentSummaries[$r['rowid']] ?? []),'cobrado'=>$received,'saldo'=>$balance,'pagoPermitido'=>$payable,'id'=>(int)$r['rowid'],'ref'=>$r['ref'],'cliente'=>$r['nom'] ?? 'Sin tercero','tipo'=>(int)$r['type'],'fecha'=>day($r['datef']),'vencimiento'=>day($r['date_lim_reglement']),'pagada'=>(bool)$r['paye'],'estado'=>(int)$r['fk_statut'],'subtotal'=>(float)$r['total_ht'],'impuesto'=>(float)$r['total_tva'],'total'=>(float)$r['total_ttc'],'pdf'=>invoiceDocumentPath($r)!==null];
}
$deliveryReady=deliveryFieldsExist('queryRows',$dolibarr_main_db_prefix);$deliveryDates=[];$coverageByOrder=[];
if($deliveryReady) foreach(queryRows("SELECT x.fk_object,x.bimbo_fecha_entrega,x.bimbo_recibido_por,x.bimbo_modalidad,x.bimbo_listo_recojo,x.bimbo_punto_recojo FROM llx_commande_extrafields x JOIN llx_commande o ON o.rowid=x.fk_object AND o.entity=$entity") as $r)$deliveryDates[$r['fk_object']]=$r;
foreach(queryRows(deliveryCoverageSql($dolibarr_main_db_prefix,$entity)) as $r)$coverageByOrder[$r['pedido_id']][]=$r;
$orderPaymentRows=[];foreach(queryRows(orderPaymentSql($dolibarr_main_db_prefix,$entity)) as $invoiceRow)$orderPaymentRows[$invoiceRow['pedido_id']][]=$invoiceRow;
$orderPaymentBlocks=[];foreach($orderPaymentRows as $oid=>$rows)$orderPaymentBlocks[$oid]=orderPaymentBlock($rows,$entity);
$orders=[];
$customers=[];
foreach(queryRows("SELECT rowid,nom,code_client FROM llx_societe WHERE entity=$entity AND status=1 AND client IN (1,3) ORDER BY nom") as $r) $customers[]=['id'=>(int)$r['rowid'],'nombre'=>$r['nom'],'codigo'=>$r['code_client'] ?: ''];
foreach(queryRows("SELECT o.rowid,o.fk_soc,o.ref,o.import_key,o.date_commande,o.date_livraison,o.fk_statut,o.total_ht,o.total_ttc,o.facture,o.ref_ext,o.note_private,s.nom,s.note_private customer_note,s.price_level customer_price_level,typ.code customer_type FROM llx_commande o LEFT JOIN llx_societe s ON s.rowid=o.fk_soc AND s.entity=o.entity LEFT JOIN llx_c_typent typ ON typ.id=s.fk_typent WHERE o.entity=$entity ORDER BY o.date_commande DESC,o.rowid DESC") as $r) $orders[]=salesChannel($r['note_private'],$r)+['origenDatos'=>reportOrigin($r),'clienteId'=>$r['fk_soc'] ? (int)$r['fk_soc'] : null,'bloqueoPago'=>$orderPaymentBlocks[$r['rowid']],'modalidad'=>($deliveryDates[$r['rowid']]['bimbo_modalidad']??'')==='recojo'?'recojo':'delivery','listoRecojo'=>day($deliveryDates[$r['rowid']]['bimbo_listo_recojo']??null),'puntoRecojo'=>$deliveryDates[$r['rowid']]['bimbo_punto_recojo']??null,'puedeGestionarRecojo'=>($deliveryDates[$r['rowid']]['bimbo_modalidad']??'')==='recojo' && empty($deliveryDates[$r['rowid']]['bimbo_fecha_entrega']) && in_array((int)$r['fk_statut'],[1,2,3],true) && deliveryEligible($coverageByOrder[$r['rowid']]??[]),'fechaEntregaReal'=>day($deliveryDates[$r['rowid']]['bimbo_fecha_entrega'] ?? null),'recibidoPor'=>$deliveryDates[$r['rowid']]['bimbo_recibido_por'] ?? null,'puedeProgramarEntrega'=>($deliveryDates[$r['rowid']]['bimbo_modalidad']??'')!=='recojo' && $deliveryReady && empty($deliveryDates[$r['rowid']]['bimbo_fecha_entrega']) && in_array((int)$r['fk_statut'],[0,1,2,3],true) && !str_contains($r['note_private'] ?? '', 'portal-delivery-v1:'),'puedeConfirmarEntrega'=>($deliveryDates[$r['rowid']]['bimbo_modalidad']??'')!=='recojo' && $deliveryReady && empty($deliveryDates[$r['rowid']]['bimbo_fecha_entrega']) && in_array((int)$r['fk_statut'],[1,2,3],true) && deliveryEligible($coverageByOrder[$r['rowid']] ?? []) && !str_contains($r['note_private'] ?? '', 'portal-delivery-v1:'),'id'=>(int)$r['rowid'],'ref'=>$r['ref'],'cliente'=>$r['nom'] ?? 'Sin tercero','fecha'=>day($r['date_commande']),'entrega'=>day($r['date_livraison']),'estado'=>(int)$r['fk_statut'],'subtotal'=>(float)$r['total_ht'],'total'=>(float)$r['total_ttc'],'facturado'=>(bool)$r['facture'],'direccionTienda'=>storeOrderAddress($r['note_private']),'cancelablePortal'=>empty($deliveryDates[$r['rowid']]['bimbo_fecha_entrega']) && !str_contains($r['note_private'] ?? '', 'portal-delivery-v1:') && in_array((int)$r['fk_statut'],[1,2,3],true) && str_starts_with($r['ref_ext'] ?? '', 'WEB-') && str_contains($r['note_private'] ?? '', 'portal-stock-v1:') && !str_contains($r['note_private'] ?? '', 'portal-cancel-v1:')];
$shipments=[];
foreach(queryRows("SELECT e.rowid,e.ref,e.date_expedition,e.date_delivery,e.fk_statut,e.tracking_number,s.nom,s.town FROM llx_expedition e LEFT JOIN llx_societe s ON s.rowid=e.fk_soc WHERE e.entity=$entity ORDER BY e.date_expedition DESC,e.rowid DESC") as $r) $shipments[]=['id'=>(int)$r['rowid'],'ref'=>$r['ref'],'cliente'=>$r['nom'] ?? 'Sin tercero','destino'=>$r['town'] ?: null,'fecha'=>day($r['date_expedition']),'entrega'=>day($r['date_delivery']),'estado'=>(int)$r['fk_statut'],'seguimiento'=>$r['tracking_number'] ?: null];
$warehouses=[];
foreach(queryRows("SELECT e.rowid,e.ref,e.address,e.town,e.statut,COUNT(ps.rowid) referencias FROM llx_entrepot e LEFT JOIN llx_product_stock ps ON ps.fk_entrepot=e.rowid WHERE e.entity=$entity GROUP BY e.rowid,e.ref,e.address,e.town,e.statut ORDER BY e.rowid") as $r) $warehouses[]=['id'=>(int)$r['rowid'],'nombre'=>$r['ref'],'direccion'=>trim(($r['address'] ?? '').' '.($r['town'] ?? '')),'abierto'=>(bool)$r['statut'],'referencias'=>(int)$r['referencias']];
$saleWarehouse=null;
$saleWarehouseId=getenv('DOLIBARR_WAREHOUSE_ID') ?: '1';
if(ctype_digit($saleWarehouseId)) foreach($warehouses as $w) if($w['id']===(int)$saleWarehouseId && $w['abierto']) $saleWarehouse=['id'=>$w['id'],'nombre'=>$w['nombre']];
$banks=[];
foreach(queryRows("SELECT a.rowid,a.label,a.currency_code,a.clos,a.courant,COALESCE(SUM(b.amount),0) balance FROM llx_bank_account a LEFT JOIN llx_bank b ON b.fk_account=a.rowid WHERE a.entity=$entity GROUP BY a.rowid,a.label,a.currency_code,a.clos,a.courant ORDER BY a.rowid") as $r) $banks[]=['abierto'=>!(bool)$r['clos'],'tipo'=>(int)$r['courant'],'id'=>(int)$r['rowid'],'nombre'=>$r['label'],'moneda'=>$r['currency_code'] ?: 'PEN','saldo'=>(float)$r['balance']];
$paymentMethods=[];
$paymentNames=['LIQ'=>'Efectivo','VIR'=>'Transferencia bancaria','CB'=>'Tarjeta','CHQ'=>'Cheque','PRE'=>'Domiciliación'];
foreach(queryRows("SELECT id,code,libelle FROM llx_c_paiement WHERE active=1 AND type IN (0,2) AND entity IN (0,$entity) ORDER BY position,id") as $r) $paymentMethods[]=['id'=>(int)$r['id'],'codigo'=>$r['code'],'nombre'=>$paymentNames[$r['code']] ?? $r['libelle']];
$totals=queryRows("SELECT (SELECT COUNT(*) FROM llx_societe WHERE entity=$entity) terceros,(SELECT COUNT(*) FROM llx_facture_fourn WHERE entity=$entity) facturasProveedor")[0];
require __DIR__.'/report-data.php';
$base=rtrim($dolibarr_main_url_root,'/');
if(!preg_match('~^https?://(localhost|127\.0\.0\.1)(:\d+)?/~i',$base)) throw new RuntimeException('Local Dolibarr URL required');
$db->commit();
echo json_encode(['fuente'=>['base'=>$dolibarr_main_db_name,'consultadoEn'=>gmdate('c'),'url'=>$base,'almacenVenta'=>$saleWarehouse],'empresa'=>['nombre'=>$constants['MAIN_INFO_SOCIETE_NOM'] ?? 'Empresa en Dolibarr','direccion'=>$constants['MAIN_INFO_SOCIETE_ADDRESS'] ?? null,'localidad'=>$constants['MAIN_INFO_SOCIETE_TOWN'] ?? null,'telefono'=>$constants['MAIN_INFO_SOCIETE_TEL'] ?? null,'correo'=>$constants['MAIN_INFO_SOCIETE_MAIL'] ?? null,'moneda'=>$constants['MAIN_MONNAIE'] ?? 'PEN'],'reportes'=>$reportData,'productos'=>$products,'clientes'=>$customers,'facturas'=>$invoices,'pedidos'=>$orders,'expediciones'=>$shipments,'almacenes'=>$warehouses,'bancos'=>$banks,'mediosPago'=>$paymentMethods,'totales'=>['terceros'=>(int)$totals['terceros'],'facturasProveedor'=>(int)$totals['facturasProveedor']]],JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);

