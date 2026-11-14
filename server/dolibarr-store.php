<?php
// Private CLI adapter. All identities below come from the server session, never query strings.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0'); ini_set('zend.exception_ignore_args', '1'); ob_start();
$portalDb = null; $portalLock = null;
class StoreError extends RuntimeException {}
function storeReply($data) { while(ob_get_level()) ob_end_clean(); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR); }
function storeRows($sql) { global $db; $r=$db->query($sql); if(!$r) throw new RuntimeException('Query failed'); $out=[]; while($row=$db->fetch_object($r)) $out[]=$row; return $out; }
function storeMeta($note, $prefix='portal-customer-v1:') { if(preg_match('/'.preg_quote($prefix,'/').'([A-Za-z0-9+\/=]+)/', $note ?? '',$m)) return json_decode(base64_decode($m[1]),true) ?: []; return []; }
function storeHasPdf($invoice) {
    global $dolibarr_main_data_root;
    if((int)$invoice->fk_statut===3) return false;
    $root=realpath($dolibarr_main_data_root); if(!$root) return false;
    $candidates=[$invoice->last_main_doc];
    if(preg_match('/^[a-zA-Z0-9_-]+$/D',$invoice->ref)) $candidates[]='facture/'.$invoice->ref.'/'.$invoice->ref.'.pdf';
    foreach($candidates as $relative) { if(!$relative) continue; $file=realpath($root.'/'.$relative); if($file && is_file($file) && strtolower(pathinfo($file,PATHINFO_EXTENSION))==='pdf' && strncasecmp(str_replace('\\','/',$file),str_replace('\\','/',$root).'/',strlen($root)+1)===0) return true; }
    return false;
}
function storeIdentity($id, $stamp=null, $issuedAt=null) {
    global $db, $conf;
    $u=new User($db);
    if($u->fetch((int)$id)<=0 || !$u->statut || !in_array((int)$u->entity,[0,(int)$conf->entity],true) || $u->isNotIntoValidityDateRange() || $u->force_pass_change) throw new StoreError('La cuenta no está habilitada. Revisa el acceso en Dolibarr.',401);
    $hash=hash('sha256',($u->pass_indatabase_crypted ?? '').':'.($u->pass_indatabase ?? '').':'.(int)$u->socid.':'.(int)$u->admin);
    if($stamp !== null && (!hash_equals($hash,$stamp) || ($u->flagdelsessionsbefore && $issuedAt < $u->flagdelsessionsbefore))) throw new StoreError('La sesión venció. Inicia sesión nuevamente.',401);
    $s=['id'=>(int)$u->id,'nombre'=>trim($u->getFullName($GLOBALS['langs'])) ?: $u->login,'rol'=>'admin','clienteId'=>null,'canal'=>null];
    if($u->socid) {
        $soc=new Societe($db);
        if($soc->fetch((int)$u->socid)<=0 || (int)$soc->entity !== (int)$conf->entity || !$soc->status || !in_array((int)$soc->client,[1,3],true)) throw new StoreError('El cliente no está habilitado.',403);
        $meta=storeMeta($soc->note_private);
        $s['rol']='cliente'; $s['clienteId']=(int)$soc->id; $s['canal']=($meta['canal'] ?? '') === 'b2c' ? 'b2c' : 'b2b';
        $s['nivelTarifa']=portalPriceLevel($soc);
    } elseif(!$u->admin) throw new StoreError('Esta cuenta no tiene acceso al panel. Solicita un administrador o una cuenta vinculada a tu cliente.',403);
    return ['ok'=>true,'sesion'=>$s,'stamp'=>$hash];
}
try {
    $input=json_decode(stream_get_contents(STDIN,65537),true,32,JSON_THROW_ON_ERROR);
    $mode=$argv[1] ?? '';
    require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
    $_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
    require_once $dolibarr_main_document_root.'/master.inc.php';
    require_once DOL_DOCUMENT_ROOT.'/core/lib/security2.lib.php';
    require_once __DIR__.'/dolibarr-pricing.php';
    require_once __DIR__.'/fulfillment.php';
    $portalDb=$db; $entity=(int)$conf->entity; $p=MAIN_DB_PREFIX;
    if($mode==='login') {
        $login=checkLoginPassEntity($input['login'] ?? '',$input['password'] ?? '',$entity,['dolibarr'],'portal');
        if(!$login || $login==='--bad-login-validity--') throw new StoreError('Usuario o contraseña incorrectos.',401);
        $u=new User($db); if($u->fetch(0,$login,'',0,$entity)<=0) throw new StoreError('Usuario o contraseña incorrectos.',401);
        storeReply(storeIdentity($u->id)); exit;
    }
    if($mode==='session') { storeReply(storeIdentity($input['userId'] ?? 0,$input['stamp'] ?? '',$input['issuedAt'] ?? 0)); exit; }
    if($mode==='register') {
        if(!in_array($input['canal'] ?? '',['b2b','b2c'],true) || !filter_var($input['correo'] ?? '',FILTER_VALIDATE_EMAIL) || strlen($input['password'] ?? '')<10 || strlen($input['password'])>128 || !preg_match(($input['canal']==='b2b' ? '/^\d{11}$/' : '/^(\d{8}|\d{11})$/'),$input['documento'] ?? '')) throw new StoreError('Revisa los datos de registro.',400);
        foreach(['nombre','contacto','telefono','direccion','ciudad'] as $field) if(!is_string($input[$field] ?? null) || strlen(trim($input[$field]))<2 || strlen($input[$field])>600 || preg_match('/[<>\x00-\x1f]/',$input[$field])) throw new StoreError('Revisa los datos de registro.',400);
        if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0 || !$user->statut || !$user->admin || $user->socid) throw new StoreError('La creación de clientes no está disponible.',503);
        $user->loadRights();
        $portalLock='bimbo-registration-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,35);
        if((int)(storeRows("SELECT GET_LOCK('".$db->escape($portalLock)."',10) acquired")[0]->acquired ?? 0)!==1) throw new StoreError('Otro registro está en curso. Reintenta.',503);
        $mail=$db->escape(strtolower(trim($input['correo']))); $doc=$db->escape($input['documento']);
        $exists=storeRows("SELECT rowid FROM {$p}user WHERE entity IN (0,$entity) AND (login='$mail' OR email='$mail') LIMIT 1");
        $company=storeRows("SELECT rowid FROM {$p}societe WHERE entity=$entity AND (email='$mail' OR siren='$doc' OR siret='$doc') LIMIT 1");
        if($exists || $company) throw new StoreError('Ya hay un registro con estos datos. Si tienes cuenta, inicia sesión; para vincular un cliente existente, contacta a administración.',409);
        $db->begin();
        $soc=new Societe($db); $soc->name=$input['nombre']; $soc->client=1; $soc->status=1; $soc->code_client=-1; $soc->fournisseur=0;
        $soc->email=strtolower($input['correo']); $soc->phone=$input['telefono']; $soc->address=$input['direccion']; $soc->town=$input['ciudad'];
        $soc->country_id=$mysoc->country_id; $soc->country_code=$mysoc->country_code; $soc->tva_assuj=1;
        if(strlen($input['documento'])===11) $soc->idprof1=$input['documento']; else $soc->idprof2=$input['documento'];
        $types=storeRows("SELECT id FROM {$p}c_typent WHERE code='".($input['canal']==='b2c' ? 'TE_PRIVATE' : 'TE_SMALL')."' LIMIT 1");
        if($types) $soc->typent_id=(int)$types[0]->id;
        $soc->note_private='Cliente de tienda '.strtoupper($input['canal']).'. portal-customer-v1:'.base64_encode(json_encode(['canal'=>$input['canal'],'contacto'=>$input['contacto']],JSON_UNESCAPED_UNICODE));
        $soc->ref_ext='STORE-'.strtoupper($input['canal']).'-'.bin2hex(random_bytes(8));
        if($soc->create($user,1)<=0) throw new RuntimeException('Customer create: '.$soc->error);
        if($soc->setPriceLevel($input['canal']==='b2b' ? 2 : 1,$user)<=0) throw new RuntimeException('Customer price level failed');
        $new=new User($db); $new->login='tienda_'.substr(hash('sha256',strtolower($input['correo'])),0,20); $new->email=strtolower($input['correo']); $new->lastname=$input['contacto']; $new->socid=(int)$soc->id; $new->admin=0; $new->statut=1; $new->entity=$entity;
        if($new->create($user,1)<=0 || !is_string($new->setPassword($user,$input['password'],0,1,1))) throw new RuntimeException('External user creation failed: '.$new->error);
        // User::create does not persist fk_soc; this is the same link used by create_from_contact.
        if(!$db->query("UPDATE {$p}user SET fk_soc=".(int)$soc->id.",admin=0,employee=0 WHERE rowid=".(int)$new->id." AND entity=$entity")) throw new RuntimeException('Customer user link failed');
        if(!$db->query("DELETE FROM {$p}user_rights WHERE fk_user=".(int)$new->id)) throw new RuntimeException('User permissions cleanup failed');
        // No native back-office privileges are granted to public registrations.
        if(!$db->query("DELETE FROM {$p}usergroup_user WHERE fk_user=".(int)$new->id)) throw new RuntimeException('User group cleanup failed');
        $identity=storeIdentity($new->id);
        if(!$db->commit()) throw new RuntimeException('Commit failed');
        storeRows("SELECT RELEASE_LOCK('".$db->escape($portalLock)."')"); $portalLock=null;
        storeReply($identity); exit;
    }
    $currency=storeRows("SELECT value FROM {$p}const WHERE name='MAIN_MONNAIE' AND entity IN (0,$entity) ORDER BY entity DESC LIMIT 1")[0]->value ?? 'PEN';
    require_once __DIR__.'/product-view.php';
    require_once __DIR__.'/order-view.php';
    if($mode==='quality'){require __DIR__.'/store-quality.php';exit;}
    if($mode==='order-detail'){$identity=storeIdentity($input['userId']??0);$db->begin();$result=portalOrderDetail((int)($input['id']??0),$identity);$db->commit();storeReply($result);exit;}
    if($mode==='product-photo'){$product=new Product($db);if($product->fetch((int)($input['id']??0))<=0||(int)$product->entity!==$entity||!$product->status||(int)$product->type!==0)throw new StoreError('Foto no disponible.',404);$photo=portalProductPhoto($product);if(!$photo)throw new StoreError('Foto no disponible.',404);storeReply(['ok'=>true,'mime'=>$photo['mime'],'base64'=>base64_encode(file_get_contents($photo['file']))]);exit;}
    if($mode==='catalog') {
        $customer=new Societe($db);
        if(!empty($input['customerId'])) {
            if($customer->fetch((int)$input['customerId'])<=0 || (int)$customer->entity!==$entity || !$customer->status || !in_array((int)$customer->client,[1,3],true)) throw new StoreError('El cliente no está disponible.',404);
        } else {
            $customer->country_id=$mysoc->country_id; $customer->country_code=$mysoc->country_code; $customer->tva_assuj=1;
            $customer->price_level=($input['canal'] ?? '')==='b2b' ? 2 : 1;
        }
        $customer=portalCustomerForChannel($customer,$input['canal'] ?? null);
        $level=portalPriceLevel($customer);
        $minimum=$level===2 ? portalWholesaleMinimum() : 0.0;
        $normalCustomer=clone $customer; $normalCustomer->price_level=1;
        $warehouse=(int)(getenv('DOLIBARR_WAREHOUSE_ID') ?: 1);
        $cats=[]; foreach(storeRows("SELECT cp.fk_product,c.label FROM {$p}categorie_product cp JOIN {$p}categorie c ON c.rowid=cp.fk_categorie WHERE c.entity=$entity AND c.type=0 ORDER BY c.label") as $c) $cats[$c->fk_product][]=$c->label;
        $products=[];
        foreach(storeRows("SELECT p.rowid,p.ref,p.label,p.description,p.price,p.price_ttc,p.tva_tx,p.tobatch,p.fk_product_type,p.stockable_product,u.short_label,COALESCE(ps.reel,0) stock,e.statut warehouse_open FROM {$p}product p LEFT JOIN {$p}c_units u ON u.rowid=p.fk_unit LEFT JOIN {$p}entrepot e ON e.rowid=$warehouse AND e.entity=$entity LEFT JOIN {$p}product_stock ps ON ps.fk_product=p.rowid AND ps.fk_entrepot=e.rowid WHERE p.entity=$entity AND p.tosell=1 AND p.fk_product_type=0 ORDER BY p.label") as $r) {
            $product=new Product($db); if($product->fetch((int)$r->rowid)<=0) throw new RuntimeException('Product price unavailable');
            $price=portalProductPrice($product,$customer);
            $normal=($level===2) ? portalProductPrice($product,$normalCustomer) : $price;
            $price['precioNormal']=$normal['precio']; $price['precioFinalNormal']=$normal['precioFinal']; $price['impuestoNormal']=$normal['impuesto'];
            $supported=!(int)$r->tobatch && (int)$r->warehouse_open===1 && $price['precio']>0;
            $products[]=array_merge(['id'=>(int)$r->rowid,'sku'=>$r->ref,'nombre'=>$r->label,'descripcion'=>trim(html_entity_decode(strip_tags($r->description ?? ''),ENT_QUOTES,'UTF-8')),'categorias'=>$cats[$r->rowid] ?? [],'disponible'=>$supported ? max(0,floor((float)$r->stock)) : 0,'unidad'=>$r->short_label,'comprable'=>$supported && (float)$r->stock>=1],$price,portalProductInfo($product));
        }
        storeReply(['ok'=>true,'productos'=>$products,'moneda'=>$currency,'nivelTarifa'=>$level,'tarifa'=>portalPriceLabel($level),'tarifaNormal'=>portalPriceLabel(1),'minimoMayorista'=>$minimum]); exit;
    }
    if(in_array($mode,['admin-notifications','admin-notifications-read'],true)){require __DIR__.'/store-admin-notifications.php';exit;}
    if(in_array($mode,['notifications','notifications-read'],true)){require __DIR__.'/store-notifications.php';exit;}
    if($mode==='account') {
        $identity=storeIdentity($input['userId'] ?? 0);
        if($identity['sesion']['rol']!=='cliente') throw new StoreError('Inicia sesión como cliente.',403);
        $id=$identity['sesion']['clienteId']; $soc=new Societe($db); $soc->fetch($id); $meta=storeMeta($soc->note_private);
        $db->begin();
        require_once __DIR__.'/delivery-state.php';
        $customerDeliveries=[];if(deliveryFieldsExist('storeRows',$p))foreach(storeRows("SELECT x.fk_object,x.bimbo_fecha_entrega FROM {$p}commande_extrafields x JOIN {$p}commande o ON o.rowid=x.fk_object WHERE o.entity=$entity AND o.fk_soc=$id") as $del)$customerDeliveries[$del->fk_object]=$del->bimbo_fecha_entrega ? substr($del->bimbo_fecha_entrega,0,10) : null;
        $orderPayments=[];foreach(storeRows(orderPaymentSql($p,$entity). '') as $row)if((int)$row->order_customer===$id)$orderPayments[$row->pedido_id][]=$row;
        $orders=[];
        $pickupFields=[];foreach(storeRows("SELECT x.fk_object,x.bimbo_modalidad,x.bimbo_listo_recojo,x.bimbo_punto_recojo FROM {$p}commande_extrafields x JOIN {$p}commande o ON o.rowid=x.fk_object WHERE o.entity=$entity AND o.fk_soc=$id") as $x)$pickupFields[$x->fk_object]=$x;
        $lines=[];
        foreach(storeRows("SELECT d.fk_commande,d.fk_product,d.qty,d.total_ttc,d.label,d.description,p.label product_label,p.ref FROM {$p}commandedet d JOIN {$p}commande o ON o.rowid=d.fk_commande LEFT JOIN {$p}product p ON p.rowid=d.fk_product WHERE o.entity=$entity AND o.fk_soc=$id ORDER BY d.rang,d.rowid") as $line) $lines[$line->fk_commande][]=['productoId'=>(int)$line->fk_product,'nombre'=>trim(strip_tags($line->product_label ?: $line->label ?: $line->description ?: 'Producto')),'sku'=>$line->ref ?: '', 'cantidad'=>(float)$line->qty,'total'=>(float)$line->total_ttc];
        foreach(storeRows("SELECT o.rowid,o.ref,o.date_commande,o.date_livraison,o.fk_statut,o.total_ttc,o.note_private,(SELECT MIN(f.rowid) FROM {$p}element_element ee JOIN {$p}facture f ON f.rowid=ee.fk_target WHERE ee.sourcetype='commande' AND ee.targettype='facture' AND ee.fk_source=o.rowid AND f.fk_soc=$id AND f.entity=$entity) invoice_id FROM {$p}commande o WHERE o.entity=$entity AND o.fk_soc=$id ORDER BY o.rowid DESC") as $r) {
            $m=storeMeta($r->note_private,'portal-store-v1:');
            $x=$pickupFields[$r->rowid]??null;
            $orders[]=['pago'=>portalPaymentSummary($orderPayments[$r->rowid]??[],$entity,(int)$r->fk_statut===-1),'modalidad'=>($x->bimbo_modalidad??'')==='recojo'?'recojo':'delivery','puntoRecojo'=>$x->bimbo_punto_recojo??null,'listoRecojo'=>!empty($x->bimbo_listo_recojo)?substr($x->bimbo_listo_recojo,0,10):null,'fechaPrevista'=>$r->date_livraison ? substr($r->date_livraison,0,10) : null,'fechaEntregaReal'=>$customerDeliveries[$r->rowid] ?? null,'id'=>(int)$r->rowid,'ref'=>$r->ref,'fecha'=>substr($r->date_commande,0,10),'estado'=>(int)$r->fk_statut,'total'=>(float)$r->total_ttc,'canal'=>$m['canal'] ?? null,'entrega'=>$m['entrega'] ?? null,'facturaId'=>$r->invoice_id ? (int)$r->invoice_id : null,'lineas'=>$lines[$r->rowid] ?? []];
        }
        $demoEnabled=getDolGlobalInt('BIMBO_DEMO_PAYMENTS_ENABLED')===1;
        $invoicePayments=[];
        foreach(storeRows("SELECT pf.fk_facture,p.rowid,p.ref,p.datep,pf.amount,p.num_paiement,m.libelle,m.code FROM {$p}paiement_facture pf JOIN {$p}paiement p ON p.rowid=pf.fk_paiement AND p.entity=$entity JOIN {$p}facture f ON f.rowid=pf.fk_facture AND f.entity=$entity AND f.fk_soc=$id LEFT JOIN {$p}c_paiement m ON m.id=p.fk_paiement ORDER BY p.datep DESC,p.rowid DESC") as $pay) $invoicePayments[$pay->fk_facture][]=['id'=>(int)$pay->rowid,'ref'=>$pay->ref ?: 'Pago #'.$pay->rowid,'fecha'=>substr($pay->datep,0,10),'importe'=>(float)$pay->amount,'metodo'=>$pay->libelle,'demostracion'=>in_array($pay->code,['DEMCB','DEMYAP','DEMPLN'],true)];
        $invoices=[];
        foreach(storeRows("SELECT f.rowid,f.ref,f.type,f.multicurrency_code,f.datef,f.last_main_doc,f.fk_statut,f.paye,f.total_ttc,COALESCE((SELECT SUM(pf.amount) FROM {$p}paiement_facture pf WHERE pf.fk_facture=f.rowid),0) paid,COALESCE((SELECT SUM(rc.amount_ttc) FROM {$p}societe_remise_except rc JOIN {$p}facture sf ON sf.rowid=rc.fk_facture_source WHERE rc.fk_facture=f.rowid AND sf.type IN (0,2,3,5) AND sf.entity=$entity),0) credits FROM {$p}facture f WHERE f.entity=$entity AND f.fk_soc=$id AND f.fk_statut<>0 ORDER BY f.rowid DESC") as $r) $invoices[]=['id'=>(int)$r->rowid,'ref'=>$r->ref,'fecha'=>substr($r->datef,0,10),'estado'=>(int)$r->fk_statut,'pagada'=>(bool)$r->paye,'total'=>(float)$r->total_ttc,'cobrado'=>(float)$r->paid,'saldo'=>!$r->paye && (int)$r->fk_statut===1 ? max(0,round($r->total_ttc-$r->paid-$r->credits,2)) : 0,'pdf'=>storeHasPdf($r),'pagoDemoPermitido'=>$demoEnabled && (int)$r->fk_statut===1 && !$r->paye && in_array((int)$r->type,[0,1],true) && (!$r->multicurrency_code || $r->multicurrency_code===$currency) && round($r->total_ttc-$r->paid-$r->credits,2)>0,'pagos'=>$invoicePayments[$r->rowid] ?? []];
        $db->commit();
        storeReply(['ok'=>true,'puntoRecojo'=>portalPickupPoint(),'perfil'=>['nombre'=>$soc->name,'contacto'=>$meta['contacto'] ?? $identity['sesion']['nombre'],'documento'=>$soc->idprof1 ?: $soc->idprof2,'correo'=>$soc->email,'telefono'=>$soc->phone,'direccion'=>$soc->address,'ciudad'=>$soc->town],'pedidos'=>$orders,'facturas'=>$invoices,'moneda'=>$currency,'pasarelaDemo'=>$demoEnabled]); exit;
    }
    throw new StoreError('Operación inválida.',400);
} catch(Throwable $e) {
    if($portalDb) { $portalDb->query('ROLLBACK'); $portalDb->transaction_opened=0; if($portalLock) $portalDb->query("SELECT RELEASE_LOCK('".$portalDb->escape($portalLock)."')"); }
    if(!($e instanceof StoreError)) error_log('Bimbo store: '.$e->getMessage());
    storeReply(['ok'=>false,'status'=>$e instanceof StoreError ? $e->getCode() : 503,'error'=>$e instanceof StoreError ? $e->getMessage() : 'No se pudo completar la operación en Dolibarr.']);
}
