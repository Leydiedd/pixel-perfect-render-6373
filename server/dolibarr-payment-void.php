<?php
// Local accounting correction, never a bank refund or money transfer.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');ob_start();
$voidDb=null;$lockName=null;$revisable=false;
require_once __DIR__.'/dolibarr-payment-void-common.php';
require_once __DIR__.'/admin-payment-report.php';
class VoidInputError extends RuntimeException {}
function voidRows($sql){global $db;$result=$db->query($sql);if(!$result)throw new RuntimeException('Void query failed');$rows=[];while($r=$db->fetch_array($result))$rows[]=$r;return $rows;}
function voidCheck($ok,$message){if(!$ok)throw new VoidInputError($message,409);}
function voidCents($amount){return (int)round((float)$amount*100);}
function voidBalance($invoice){
 $values=[$invoice->getSommePaiement(),$invoice->getSumCreditNotesUsed(),$invoice->getSumDepositsUsed()];
 foreach($values as $v)if($v!==null && (!is_numeric($v)||(float)$v<0))throw new RuntimeException('Invalid invoice balance');
 return voidCents($invoice->total_ttc)-array_sum(array_map('voidCents',$values));
}
try {
 $raw=stream_get_contents(STDIN,8193);
 if(strlen($raw)>8192)throw new VoidInputError('Solicitud demasiado grande.',400);
 $input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
 foreach(['facturaId','pagoId'] as $key)if(!is_int($input[$key] ?? null)||$input[$key]<1)throw new VoidInputError('Factura o pago inválido.',400);
 if(!is_string($input['solicitudId'] ?? null)||!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i',$input['solicitudId']))throw new VoidInputError('Solicitud inválida.',400);
 if(!is_string($input['huella'] ?? null)||!preg_match('/^[a-f0-9]{64}$/D',$input['huella']))throw new VoidInputError('Actualiza el historial antes de anular.',400);
 if(!is_numeric($input['saldoEsperado'] ?? null)||!is_finite((float)$input['saldoEsperado'])||$input['saldoEsperado']<0||$input['saldoEsperado']>100000000)throw new VoidInputError('Saldo inválido.',400);
 $reason=is_string($input['motivo'] ?? null)?trim($input['motivo']):'';
 if(mb_strlen($reason)<3||mb_strlen($reason)>500||preg_match('/[<>\x00-\x1f]/',$reason))throw new VoidInputError('Escribe un motivo de 3 a 500 caracteres.',400);
 $fid=$input['facturaId'];$pid=$input['pagoId'];$nonce=strtolower($input['solicitudId']);
 $hash=hash('sha256',json_encode([$fid,$pid,$input['huella'],voidCents($input['saldoEsperado']),$reason],JSON_THROW_ON_ERROR));
 require_once (getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php');
 $_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
 require_once $dolibarr_main_document_root.'/master.inc.php';$voidDb=$db;
 if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0||!$user->statut)throw new VoidInputError('Usuario de integración no disponible.',403);
 $user->loadRights();
 if(!isModEnabled('facture')||!isModEnabled('bank')||!$user->hasRight('facture','paiement')||!$user->hasRight('facture','creer')||!$user->hasRight('banque','modifier'))throw new VoidInputError('No hay permisos para anular cobros y actualizar la factura en Dolibarr.',403);
 require_once DOL_DOCUMENT_ROOT.'/compta/facture/class/facture.class.php';
 require_once DOL_DOCUMENT_ROOT.'/compta/paiement/class/paiement.class.php';
 $prefix=MAIN_DB_PREFIX;$entity=(int)$conf->entity;
 $hasAccounting=(bool)voidRows("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='".$db->escape($prefix."accounting_bookkeeping")."'");
 $lockName='bimbo-orders-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,40);
 if((int)(voidRows("SELECT GET_LOCK('".$db->escape($lockName)."',10) acquired")[0]['acquired'])!==1)throw new VoidInputError('Hay otra operación en curso. Reintenta la misma anulación.',503);
 if(!$db->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')||!$db->begin())throw new RuntimeException('Void transaction failed');
 $revisable=true;
 $f=voidRows("SELECT rowid,ref,type,fk_statut,paye,multicurrency_code,note_private FROM {$prefix}facture WHERE rowid=$fid AND entity=$entity FOR UPDATE")[0] ?? null;
 voidCheck($f!==null,'La factura no pertenece a esta entidad.');
 $invoice=new Facture($db);if($invoice->fetch($fid)<=0)throw new RuntimeException('Invoice fetch failed');
 $audit=null;
 foreach(voidPaymentAudit($invoice->note_private) as $entry) {
  if($entry['solicitudId']===$nonce || (int)$entry['pago']['id']===$pid) {
   voidCheck((int)$entry['pago']['id']===$pid && hash_equals($entry['hash'],$hash),'Este pago ya fue anulado con otra solicitud. Actualiza el historial.');
   $audit=$entry;break;
  }
 }
 $repeated=$audit!==null;
 if($repeated) {
  voidCheck(!voidRows("SELECT rowid FROM {$prefix}paiement WHERE rowid=$pid"),'El pago anulado fue modificado. Revísalo en Dolibarr.');
 } else {
  // Lock all invoice allocations, the original payment and its bank movement before rereading.
  voidRows("SELECT rowid FROM {$prefix}paiement_facture WHERE fk_facture=$fid OR fk_paiement=$pid FOR UPDATE");
  $p=voidRows("SELECT rowid,fk_bank FROM {$prefix}paiement WHERE rowid=$pid AND entity=$entity FOR UPDATE")[0] ?? null;
  voidCheck($p!==null,'El pago ya no está disponible. Actualiza el historial.');
  $bid=(int)$p['fk_bank'];
  if($bid>0){
   $bank=voidRows("SELECT rowid,fk_account FROM {$prefix}bank WHERE rowid=$bid FOR UPDATE")[0] ?? null;
   if($bank)voidRows("SELECT rowid FROM {$prefix}bank_account WHERE rowid=".(int)$bank['fk_account']." FOR UPDATE");
   voidRows("SELECT rowid FROM {$prefix}bank_url WHERE fk_bank=$bid FOR UPDATE");
  }
  voidRows("SELECT rowid FROM {$prefix}societe_remise_except WHERE fk_facture=$fid FOR UPDATE");
  $rows=voidRows(voidPaymentSql($prefix,$entity,$fid,$hasAccounting));$selected=null;
  foreach($rows as $row)if((int)$row['rowid']===$pid)$selected=$row;
  voidCheck($selected!==null,'El pago no está vinculado a esta factura.');
  $f['accounted']=$hasAccounting ? count(voidRows("SELECT rowid FROM {$prefix}accounting_bookkeeping WHERE doc_type='customer_invoice' AND fk_doc=$fid FOR UPDATE")) : 0;
  if($hasAccounting && $bid>0)voidRows("SELECT rowid FROM {$prefix}accounting_bookkeeping WHERE doc_type='bank' AND fk_doc=$bid FOR UPDATE");
  $blocked=voidPaymentReason($selected,$f,$conf->currency);voidCheck($blocked===null,$blocked ?: 'Pago no anulable.');
  voidCheck(hash_equals(voidPaymentFingerprint($selected),$input['huella']),'El pago cambió desde que abriste el historial. Actualiza antes de anularlo.');
  voidCheck(!voidRows("SELECT rowid FROM {$prefix}prelevement_demande WHERE fk_facture=$fid AND traite=0 FOR UPDATE"),'Hay un cobro automático pendiente. Revísalo en Dolibarr.');
  $before=voidBalance($invoice);$amount=voidCents($selected['applied']);
  voidCheck($before>=0 && $before===voidCents($input['saldoEsperado']) && (!$invoice->paye || $before===0),'El saldo de la factura cambió. Actualiza antes de anular el pago.');
  $payment=new Paiement($db);if($payment->fetch($pid)<=0)throw new RuntimeException('Payment fetch failed');
  $conf->global->MAIN_DISABLE_PDF_AUTOUPDATE='1';
  if((int)$invoice->status===2 || $invoice->paye)if($invoice->setUnpaid($user)<=0)throw new RuntimeException('Native invoice reopening failed');
  // Some installations do not have the accounting module tables. Avoid the
  // native unconditional query ONLY after proving no bookkeeping table exists.
  // No global setting is persisted; when the table exists we always reject entries.
  $accountingFlag=$conf->global->BANK_ALLOW_TRANSACTION_DELETION_EVEN_IF_IN_ACCOUNTING ?? null;
  try {
   if(!$hasAccounting)$conf->global->BANK_ALLOW_TRANSACTION_DELETION_EVEN_IF_IN_ACCOUNTING='1';
   if($payment->delete($user)<=0)throw new RuntimeException('Native payment deletion failed: '.$payment->error);
  } finally {
   if($accountingFlag===null)unset($conf->global->BANK_ALLOW_TRANSACTION_DELETION_EVEN_IF_IN_ACCOUNTING);else $conf->global->BANK_ALLOW_TRANSACTION_DELETION_EVEN_IF_IN_ACCOUNTING=$accountingFlag;
  }
  if($invoice->fetch($fid)<=0)throw new RuntimeException('Invoice refresh failed');
  if(voidBalance($invoice)!==$before+$amount || $invoice->paye || (int)$invoice->status!==1)throw new RuntimeException('Voided payment balance mismatch');
  if(voidRows("SELECT rowid FROM {$prefix}paiement WHERE rowid=$pid") || voidRows("SELECT rowid FROM {$prefix}paiement_facture WHERE fk_paiement=$pid") || ($bid>0 && (voidRows("SELECT rowid FROM {$prefix}bank WHERE rowid=$bid") || voidRows("SELECT rowid FROM {$prefix}bank_url WHERE fk_bank=$bid"))))throw new RuntimeException('Payment links remain');
  $names=['LIQ'=>'Efectivo','VIR'=>'Transferencia bancaria','CB'=>'Tarjeta','CHQ'=>'Cheque','PRE'=>'Domiciliación'];
  $audit=['solicitudId'=>$nonce,'hash'=>$hash,'fecha'=>date('c'),'motivo'=>$reason,'usuario'=>(string)$user->login,'pago'=>['demostracion'=>adminPaymentIsDemo($selected),'id'=>$pid,'ref'=>$selected['ref'] ?: 'Pago #'.$pid,'importe'=>$amount/100,'fecha'=>substr($selected['datep'] ?? '',0,10),'fechaRegistro'=>!empty($selected['datec'])?gmdate('c',$db->jdate($selected['datec'])):null,'cuenta'=>$selected['label'] ?: null,'medio'=>$names[$selected['code']] ?? ($selected['libelle'] ?: 'No registrado'),'referencia'=>$selected['num_paiement'] ?: null,'movimientoId'=>$bid]];
  $note=($invoice->note_private ?? '')."\nPago ".$audit['pago']['ref'].' anulado por '.$user->login.': '.$reason."\nportal-payment-void-v1:".base64_encode(json_encode($audit,JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
  if($invoice->update_note($note,'_private',1)<=0)throw new RuntimeException('Void audit failed');
 }
 if(!$db->commit())throw new RuntimeException('Void commit failed');
 $revisable=false;$pdf=false;
 // Regenerate after commit. A PDF failure does not undo or repeat the correction.
 try{$conf->global->TCPDF_THROW_ERRORS_INSTEAD_OF_DIE='1';$invoice->fetch_thirdparty();$pdf=$invoice->generateDocument('',$langs)>0;}catch(Throwable $pdfError){error_log('Payment void saved; invoice PDF refresh failed');}
 $balance=(int)$invoice->status===1 && !$invoice->paye ? max(0,voidBalance($invoice)/100):0;
 $db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");$lockName=null;
 while(ob_get_level())ob_end_clean();
 echo json_encode(['ok'=>true,'repetido'=>$repeated,'pago'=>$audit['pago'],'factura'=>['id'=>$fid,'ref'=>$invoice->ref,'saldo'=>$balance,'estado'=>(int)$invoice->status,'pagada'=>(bool)$invoice->paye],'aviso'=>$pdf?null:'El pago está anulado. Regenera el PDF de la factura en Dolibarr para reflejar el saldo actualizado.'],JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}catch(Throwable $e){
 if($voidDb){$voidDb->query('ROLLBACK');$voidDb->transaction_opened=0;if($lockName)$voidDb->query("SELECT RELEASE_LOCK('".$voidDb->escape($lockName)."')");}
 while(ob_get_level())ob_end_clean();
 if(!$e instanceof VoidInputError)error_log('Portal payment void: '.$e->getMessage());
 echo json_encode(['ok'=>false,'status'=>$e instanceof VoidInputError?$e->getCode():503,'error'=>$e instanceof VoidInputError?$e->getMessage():'No se pudo confirmar la anulación. Reintenta la misma solicitud para recuperar el resultado.','revisable'=>$revisable && $e instanceof VoidInputError],JSON_UNESCAPED_UNICODE);
}
