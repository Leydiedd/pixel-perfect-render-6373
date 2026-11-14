<?php
// Local bookkeeping only: records an already received customer payment, never charges a bank.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');ob_start();
$paymentDb=null;$lockName=null;$revisable=false;$demoPaymentContext=null;
class PaymentInputError extends RuntimeException {}
function paymentRows($sql) {
    global $db;$r=$db->query($sql);
    if (!$r) throw new RuntimeException('Payment lookup failed: '.$db->lasterror());
    $rows=[];while($row=$db->fetch_object($r)) $rows[]=$row;return $rows;
}
function paymentCheck($ok,$message) {if(!$ok) throw new PaymentInputError($message,409);}
function paymentCents($v) {return (int)round((float)$v*100);}
function paymentBalance($invoice) {
    $paid=$invoice->getSommePaiement();$credits=$invoice->getSumCreditNotesUsed();$deposits=$invoice->getSumDepositsUsed();
    foreach([$paid,$credits,$deposits] as $v) if ($v!==null && (!is_numeric($v) || (float)$v<0)) throw new RuntimeException('Invalid invoice balance');
    return paymentCents($invoice->total_ttc)-paymentCents($paid)-paymentCents($credits)-paymentCents($deposits);
}
try {
    $raw=stream_get_contents(STDIN,8193);
    if(strlen($raw)>8192) throw new PaymentInputError('Solicitud demasiado grande.',400);
    $input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    require_once (getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php');
    $_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
    require_once $dolibarr_main_document_root.'/master.inc.php';$paymentDb=$db;
    if(($argv[1] ?? '')==='customer-demo') {
        require_once __DIR__.'/dolibarr-demo-payment.php';
        $input=normalizeDemoPayment($input,$demoPaymentContext);
    }
    foreach(['facturaId','cuentaId','medioId'] as $field) if(!is_int($input[$field] ?? null) || $input[$field]<1) throw new PaymentInputError('Selecciona factura, cuenta y medio de pago.',400);
    foreach(['importe','saldoEsperado'] as $field) if(!is_numeric($input[$field] ?? null) || !is_finite((float)$input[$field]) || $input[$field]<=0 || $input[$field]>100000000 || abs((float)$input[$field]*100-round((float)$input[$field]*100))>0.000001) throw new PaymentInputError('El importe debe ser positivo y tener como máximo dos decimales.',400);
    if(!is_string($input['solicitudId'] ?? null) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i',$input['solicitudId'])) throw new PaymentInputError('Identificador de pago inválido.',400);
    if(!is_string($input['fecha'] ?? null) || !preg_match('/^\d{4}-\d{2}-\d{2}$/',$input['fecha']) || !($date=DateTimeImmutable::createFromFormat('!Y-m-d',$input['fecha'])) || $date->format('Y-m-d')!==$input['fecha']) throw new PaymentInputError('Fecha de pago inválida.',400);
    if(!is_string($input['referencia'] ?? null) || mb_strlen($input['referencia'])>60 || preg_match('/[<>\x00-\x1f]/',$input['referencia'])) throw new PaymentInputError('Referencia inválida: máximo 60 caracteres de texto.',400);
    $fid=$input['facturaId'];$aid=$input['cuentaId'];$methodId=$input['medioId'];$cents=paymentCents($input['importe']);
    $hash=hash('sha256',json_encode([$fid,$aid,$methodId,$cents,paymentCents($input['saldoEsperado']),$input['fecha'],trim($input['referencia'])]));

    if($demoPaymentContext) $hash=hash('sha256',$hash.':'.json_encode($demoPaymentContext));
    if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0 || !$user->statut) throw new PaymentInputError('Usuario de integración no disponible.',403);
    $user->loadRights();
    if(!isModEnabled('facture') || !isModEnabled('bank') || !$user->hasRight('facture','paiement') || !$user->hasRight('banque','modifier')) throw new PaymentInputError('Se necesitan permisos para registrar cobros y movimientos bancarios en Dolibarr.',403);
    require_once DOL_DOCUMENT_ROOT.'/compta/facture/class/facture.class.php';
    require_once DOL_DOCUMENT_ROOT.'/compta/paiement/class/paiement.class.php';
    $prefix=MAIN_DB_PREFIX;$entity=(int)$conf->entity;$ext='WEB-PAY-'.strtolower($input['solicitudId']);
    // Coordinate with order creation and cancellation as well as other payments.
    $lockName='bimbo-orders-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,40);
    $locked=paymentRows("SELECT GET_LOCK('".$db->escape($lockName)."',10) acquired");
    if((int)$locked[0]->acquired!==1) throw new PaymentInputError('Hay otra operación en curso. Reintenta el mismo pago.',503);
    if(!$db->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED') || !$db->begin()) throw new RuntimeException('Payment transaction failed');
    paymentCheck(count(paymentRows("SELECT rowid FROM {$prefix}facture WHERE rowid=$fid AND entity=$entity FOR UPDATE"))===1,'La factura no pertenece a esta entidad.');
    $invoice=new Facture($db);if($invoice->fetch($fid)<=0) throw new RuntimeException('Invoice fetch failed');
    if($demoPaymentContext) validateDemoPaymentLocked($demoPaymentContext,$fid,$aid);
    $existing=paymentRows("SELECT rowid,note FROM {$prefix}paiement WHERE entity=$entity AND ref_ext='".$db->escape($ext)."' FOR UPDATE");
    paymentCheck(count($existing)<=1,'Hay registros duplicados para esta solicitud. Revísalos en Dolibarr.');
    $hasMarker=preg_match('/(?:^|\n)portal-payment-v1:'.preg_quote(strtolower($input['solicitudId']),'/').':(\d+):([a-f0-9]{64})(?:\s|$)/',$invoice->note_private ?? '',$marker);
    paymentCheck(!$hasMarker || (count($existing)===1 && (int)$marker[1]===(int)$existing[0]->rowid && hash_equals($marker[2],$hash)),'Este pago ya se registró pero fue modificado o eliminado. Revísalo en Dolibarr; no se creó otro cobro.');
    $repeated=(bool)$existing;$payment=new Paiement($db);
    if($existing) {
        paymentCheck(str_contains($existing[0]->note ?? '', 'portal-payment-sha256:'.$hash),'Esta solicitud ya registró otro contenido. No se creó un segundo pago.');
        if($payment->fetch((int)$existing[0]->rowid)<=0) throw new RuntimeException('Payment recovery failed');
    } else {
        $revisable=true;
        paymentCheck((int)$invoice->status===1 && !$invoice->paye && in_array((int)$invoice->type,[0,1],true),'Solo se pueden registrar cobros de facturas de venta validadas y pendientes.');
        paymentCheck(empty($invoice->multicurrency_code) || $invoice->multicurrency_code===$conf->currency,'Esta factura utiliza otra moneda. Registra su pago desde Dolibarr.');
        paymentCheck($input['fecha']<=date('Y-m-d') && $input['fecha']>=date('Y-m-d',$invoice->date),'La fecha debe estar entre la emisión de la factura y hoy.');
        paymentRows("SELECT rowid FROM {$prefix}paiement_facture WHERE fk_facture=$fid FOR UPDATE");
        paymentRows("SELECT rowid FROM {$prefix}societe_remise_except WHERE fk_facture=$fid FOR UPDATE");
        paymentCheck(!paymentRows("SELECT rowid FROM {$prefix}prelevement_demande WHERE fk_facture=$fid AND traite=0 FOR UPDATE"),'La factura tiene un cobro automático pendiente. Revísalo en Dolibarr.');
        $remaining=paymentBalance($invoice);
        paymentCheck($remaining>0 && $remaining===paymentCents($input['saldoEsperado']),'El saldo de la factura cambió. Actualiza y revisa el importe antes de registrar el pago.');
        paymentCheck($cents<=$remaining,'El importe supera el saldo pendiente de la factura.');
        $accounts=paymentRows("SELECT rowid,label,currency_code,courant,clos FROM {$prefix}bank_account WHERE rowid=$aid AND entity=$entity FOR UPDATE");
        paymentCheck(count($accounts)===1 && !$accounts[0]->clos && $accounts[0]->currency_code===$conf->currency,'Selecciona una cuenta abierta en la moneda de la empresa.');
        $methods=paymentRows("SELECT id,code,libelle FROM {$prefix}c_paiement WHERE id=$methodId AND active=1 AND type IN (0,2) AND entity IN (0,$entity) FOR UPDATE");
        paymentCheck(count($methods)===1,'El medio de pago no está habilitado para cobros.');
        paymentCheck(($methods[0]->code==='LIQ')===((int)$accounts[0]->courant===2),'Para efectivo selecciona una caja; para otros medios, una cuenta bancaria.');
        $payment->datepaye=dol_mktime(12,0,0,(int)substr($input['fecha'],5,2),(int)substr($input['fecha'],8,2),(int)substr($input['fecha'],0,4));
        $payment->amounts=[$fid=>$cents/100];$payment->multicurrency_amounts=[];$payment->multicurrency_code=[$fid=>$conf->currency];
        $payment->paiementid=$methodId;$payment->paiementcode=$methods[0]->code;$payment->fk_account=$aid;
        $payment->num_payment=trim($input['referencia']);$payment->ref_ext=$ext;
        $payment->note_private='Cobro registrado desde el portal para '.$invoice->ref.'. portal-payment-sha256:'.$hash;
        if($demoPaymentContext) $payment->note_private .= "\nSIMULACION SIN DINERO REAL - ".strtoupper($demoPaymentContext['metodo']).'. portal-demo-payment-v1:'.base64_encode(json_encode($demoPaymentContext));
        // Keep filesystem effects out of the transaction; PDF refresh runs after commit.
        $conf->global->MAIN_DISABLE_PDF_AUTOUPDATE='1';
        $invoice->fetch_thirdparty();
        if($payment->create($user,0,$invoice->thirdparty)<=0) throw new RuntimeException('Native payment creation failed: '.$payment->error);
        if($payment->addPaymentToBank($user,'payment',$demoPaymentContext ? 'SIMULACION DEMO '.strtoupper($demoPaymentContext['metodo']) : '(CustomerInvoicePayment)',$aid,'','',1)<=0) throw new RuntimeException('Native bank entry failed: '.$payment->error);
        if(paymentBalance($invoice)!==$remaining-$cents) throw new RuntimeException('Payment balance mismatch');
        if($remaining===$cents && $invoice->setPaid($user)<=0) throw new RuntimeException('Invoice paid status failed');
        if($payment->fetch($payment->id)<=0 || $invoice->fetch($fid)<=0) throw new RuntimeException('Final payment fetch failed');
        if((bool)$invoice->paye!==($remaining===$cents)) throw new RuntimeException('Final invoice status mismatch');
        $note=($invoice->note_private ?? '')."\nportal-payment-v1:".strtolower($input['solicitudId']).':'.$payment->id.':'.$hash;
        if($demoPaymentContext) $note .= "\nSIMULACION SIN DINERO REAL: ".strtoupper($demoPaymentContext['metodo']).' - '.$payment->ref;
        if($invoice->update_note($note,'_private',1)<=0) throw new RuntimeException('Payment recovery marker failed');
    }
    $pid=(int)$payment->id;$bid=(int)$payment->bank_line;
    $links=paymentRows("SELECT fk_facture,amount FROM {$prefix}paiement_facture WHERE fk_paiement=$pid");
    $bank=paymentRows("SELECT b.rowid,b.amount,b.fk_account,a.label FROM {$prefix}bank b JOIN {$prefix}bank_account a ON a.rowid=b.fk_account WHERE b.rowid=$bid AND a.entity=$entity");
    paymentCheck(count($links)===1 && (int)$links[0]->fk_facture===$fid && paymentCents($links[0]->amount)===$cents && count($bank)===1 && (int)$bank[0]->fk_account===$aid && paymentCents($bank[0]->amount)===$cents && paymentCents($payment->amount)===$cents,'El pago o su movimiento bancario cambió. Revísalo en Dolibarr; no se creó otro pago.');
    $balance=paymentBalance($invoice);
    if(!$repeated && $demoPaymentContext!==null) {
        require_once __DIR__.'/admin-notifications.php';
        portalAdminNotification($invoice,'pago_cliente',$input['solicitudId'],$demoPaymentContext['canal'],$cents/100,$demoPaymentContext['metodo'],$pid);
    }
    if(!$db->commit()) throw new RuntimeException('Payment commit failed');
    $revisable=false;$pdf=false;
    try {
        $conf->global->TCPDF_THROW_ERRORS_INSTEAD_OF_DIE='1';$invoice->fetch_thirdparty();
        $pdf=$invoice->generateDocument('', $langs)>0;
    } catch(Throwable $pdfError) {error_log('Payment saved; invoice PDF refresh failed');}
    $db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");$lockName=null;
    while(ob_get_level()) ob_end_clean();
    echo json_encode(['ok'=>true,'repetido'=>$repeated,'demostracion'=>$demoPaymentContext!==null,'metodo'=>$demoPaymentContext['metodo'] ?? null,'pago'=>['id'=>$pid,'ref'=>(string)$payment->ref,'importe'=>$cents/100,'fecha'=>$input['fecha'],'movimientoId'=>$bid,'cuenta'=>$bank[0]->label],'factura'=>['id'=>$fid,'ref'=>$invoice->ref,'estado'=>(int)$invoice->status,'pagada'=>(bool)$invoice->paye,'saldo'=>max(0,$balance/100)],'aviso'=>$pdf ? null : 'El pago está registrado. Regenera el PDF de la factura en Dolibarr para incluir el nuevo cobro.'],JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch(Throwable $e) {
    if($paymentDb) {$paymentDb->query('ROLLBACK');$paymentDb->transaction_opened=0;if($lockName) $paymentDb->query("SELECT RELEASE_LOCK('".$paymentDb->escape($lockName)."')");}
    while(ob_get_level()) ob_end_clean();
    if(!$e instanceof PaymentInputError) error_log('Portal payment: '.$e->getMessage());
    echo json_encode(['ok'=>false,'status'=>$e instanceof PaymentInputError ? $e->getCode() : 503,'error'=>$e instanceof PaymentInputError ? $e->getMessage() : 'No se pudo confirmar el pago. Reintenta la misma solicitud para recuperar el resultado sin duplicarlo.','revisable'=>$revisable && $e instanceof PaymentInputError],JSON_UNESCAPED_UNICODE);
}
