<?php
// Server-only simulation. No provider, card data, wallet account, or bank charge is involved.
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
function demoPaymentMethods() { return ['tarjeta'=>['code'=>'DEMCB','label'=>'Tarjeta (DEMO)'],'yape'=>['code'=>'DEMYAP','label'=>'Yape (DEMO)'],'plin'=>['code'=>'DEMPLN','label'=>'Plin (DEMO)']]; }
function demoPaymentCustomer($uid,$fid,$locked=false) {
    global $db,$conf;
    $p=MAIN_DB_PREFIX;$entity=(int)$conf->entity;
    $rows=paymentRows("SELECT u.rowid,u.fk_soc,s.note_private FROM {$p}user u JOIN {$p}societe s ON s.rowid=u.fk_soc AND s.entity=$entity JOIN {$p}facture f ON f.fk_soc=s.rowid AND f.entity=$entity WHERE u.rowid=$uid AND u.entity IN(0,$entity) AND u.statut=1 AND u.admin=0 AND s.status=1 AND s.client IN(1,3) AND f.rowid=$fid".($locked?' FOR UPDATE':''));
    if(count($rows)!==1) throw new PaymentInputError('No se encontró una factura disponible para tu cuenta.',404);
    $account=new User($db);
    if($account->fetch($uid)<=0 || $account->isNotIntoValidityDateRange() || $account->force_pass_change) throw new PaymentInputError('La cuenta no está habilitada.',403);
    $meta=[];
    if(preg_match('/portal-customer-v1:([A-Za-z0-9+\/=]+)/',$rows[0]->note_private ?? '',$m)) $meta=json_decode(base64_decode($m[1]),true) ?: [];
    // Both B2B and B2C customer accounts may pay their own invoices.
    return (int)$rows[0]->fk_soc;
}
function demoPaymentEnabled() {
    if(!getDolGlobalInt('BIMBO_DEMO_PAYMENTS_ENABLED')) throw new PaymentInputError('La pasarela de pagos no está habilitada.',403);
}
function normalizeDemoPayment($request,&$context) {
    global $db,$conf;
    $keys=array_keys($request);sort($keys);
    if($keys!==['facturaId','metodo','saldoEsperado','solicitudId','usuarioId'] || !is_int($request['usuarioId']) || $request['usuarioId']<1 || !is_int($request['facturaId']) || $request['facturaId']<1 || !is_string($request['solicitudId']) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i',$request['solicitudId']) || !isset(demoPaymentMethods()[$request['metodo'] ?? ''])) throw new PaymentInputError('Solicitud de pago inválida.',400);
    demoPaymentEnabled();
    $uid=$request['usuarioId'];$fid=$request['facturaId'];
    $cid=demoPaymentCustomer($uid,$fid);
    $socMeta=paymentRows("SELECT note_private FROM ".MAIN_DB_PREFIX."societe WHERE rowid=$cid AND entity=".(int)$conf->entity)[0]->note_private??'';$channel='b2b';if(preg_match('/portal-customer-v1:([A-Za-z0-9+\/=]+)/',$socMeta,$m)&&((json_decode(base64_decode($m[1]),true)['canal']??'')==='b2c'))$channel='b2c';
    $invoiceNote=paymentRows("SELECT note_private FROM ".MAIN_DB_PREFIX."facture WHERE rowid=$fid AND fk_soc=$cid AND entity=".(int)$conf->entity)[0]->note_private??'';
    if(preg_match('/portal-store-v1:([A-Za-z0-9+\/=]+)/',$invoiceNote,$im)){$sale=json_decode(base64_decode($im[1]),true);if(in_array($sale['canal']??'',['b2b','b2c'],true))$channel=$sale['canal'];}
    $context=['usuarioId'=>$uid,'clienteId'=>$cid,'canal'=>$channel,'metodo'=>$request['metodo'],'demostracion'=>true];
    $aid=getDolGlobalInt('BIMBO_DEMO_PAYMENT_ACCOUNT_ID');$entity=(int)$conf->entity;$p=MAIN_DB_PREFIX;
    $method=demoPaymentMethods()[$request['metodo']];
    $methods=paymentRows("SELECT id FROM {$p}c_paiement WHERE code='".$db->escape($method['code'])."' AND entity=$entity AND active=1 AND type IN(0,2)");
    if(count($methods)!==1 || $aid<1) throw new PaymentInputError('La pasarela de pagos requiere configuración en Dolibarr.',503);
    // The native payment date is stable when recovering a successful request on a later day.
    $ext='WEB-PAY-'.strtolower($request['solicitudId']);
    $existing=paymentRows("SELECT p.datep FROM {$p}paiement p JOIN {$p}paiement_facture pf ON pf.fk_paiement=p.rowid AND pf.fk_facture=$fid WHERE p.entity=$entity AND p.ref_ext='".$db->escape($ext)."'");
    $date=$existing ? substr($existing[0]->datep,0,10) : (new DateTimeImmutable('now',new DateTimeZone('America/Lima')))->format('Y-m-d');
    return ['solicitudId'=>$request['solicitudId'],'facturaId'=>$fid,'cuentaId'=>$aid,'medioId'=>(int)$methods[0]->id,'importe'=>$request['saldoEsperado'],'saldoEsperado'=>$request['saldoEsperado'],'fecha'=>$date,'referencia'=>'DEMO-'.strtoupper($request['metodo']).'-'.strtolower($request['solicitudId'])];
}
function validateDemoPaymentLocked($context,$fid,$aid) {
    global $conf;
    demoPaymentEnabled();demoPaymentCustomer($context['usuarioId'],$fid,true);
    $p=MAIN_DB_PREFIX;$entity=(int)$conf->entity;
    $accounts=paymentRows("SELECT ref,currency_code,clos,courant FROM {$p}bank_account WHERE rowid=$aid AND entity=$entity FOR UPDATE");
    if(count($accounts)!==1 || $accounts[0]->ref!=='WEB-DEMO' || $accounts[0]->clos || (int)$accounts[0]->courant===2 || $accounts[0]->currency_code!==$conf->currency || $aid!==getDolGlobalInt('BIMBO_DEMO_PAYMENT_ACCOUNT_ID')) throw new PaymentInputError('La cuenta de pagos no está disponible. No se registró ningún cobro.',409);
}
