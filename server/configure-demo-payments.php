<?php
if(PHP_SAPI!=='cli') {http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');
require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
if(($argv[1] ?? '')!=='--apply' || ($argv[2] ?? '')!==$dolibarr_main_db_name) {fwrite(STDERR,"Use --apply EXACT_DATABASE\n");exit(1);}
$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);require_once $dolibarr_main_document_root.'/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';require_once DOL_DOCUMENT_ROOT.'/compta/bank/class/account.class.php';
require_once __DIR__.'/dolibarr-demo-payment.php';
function setupDemoRows($sql){global $db;$r=$db->query($sql);if(!$r)throw new RuntimeException('Setup query failed');$out=[];while($row=$db->fetch_object($r))$out[]=$row;return $out;}
$demoSetupLock='bimbo-demo-setup-'.substr(hash('sha256',$dolibarr_main_db_name),0,30);$demoSetupLocked=false;
try {
 if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0 || !$user->admin || !$user->statut || $user->socid)throw new RuntimeException('Administrator required');
 $user->loadRights();$entity=(int)$conf->entity;$p=MAIN_DB_PREFIX;
 if((int)setupDemoRows("SELECT GET_LOCK('".$db->escape($demoSetupLock)."',10) n")[0]->n!==1)throw new RuntimeException('Setup busy');$demoSetupLocked=true;
 $db->begin();$found=setupDemoRows("SELECT rowid,label,currency_code,clos,courant FROM {$p}bank_account WHERE entity=$entity AND ref='WEB-DEMO' FOR UPDATE");
 if(count($found)>1)throw new RuntimeException('Duplicate demo accounts');
 if($found) {
   if($found[0]->clos || $found[0]->currency_code!==$conf->currency || (int)$found[0]->courant===2 || $found[0]->label!=='Pasarela DEMO - sin dinero')throw new RuntimeException('Existing demo account changed; review configuration');
   $aid=(int)$found[0]->rowid;
 } else {
   $account=new Account($db);$account->ref='WEB-DEMO';$account->label='Pasarela DEMO - sin dinero';$account->type=1;$account->courant=1;$account->currency_code=$conf->currency;$account->country_id=$mysoc->country_id;$account->date_solde=dol_now();$account->balance=0;$account->rappro=0;$account->comment='SIMULACION ACADEMICA. No recibe ni mueve dinero real. Pagos ficticios de tarjeta, Yape y Plin.';
   $aid=$account->create($user,1);if($aid<=0)throw new RuntimeException('Could not create simulation account: '.$account->error);
 }
 foreach(demoPaymentMethods() as $method) {
   $code=$db->escape($method['code']);$label=$db->escape($method['label']);$existing=setupDemoRows("SELECT id,libelle,active,type FROM {$p}c_paiement WHERE code='$code' AND entity=$entity");
   if($existing) {if(count($existing)!==1 || $existing[0]->libelle!==$method['label'] || !$existing[0]->active || !in_array((int)$existing[0]->type,[0,2],true))throw new RuntimeException('Demo method modified');}
   elseif(!$db->query("INSERT INTO {$p}c_paiement(entity,code,libelle,type,active,position) VALUES($entity,'$code','$label',0,1,90)"))throw new RuntimeException('Could not create simulation method');
 }
 foreach(['BIMBO_DEMO_PAYMENT_ACCOUNT_ID'=>(string)$aid,'BIMBO_DEMO_PAYMENTS_ENABLED'=>'1'] as $name=>$value) if(dolibarr_set_const($db,$name,$value,'chaine',1,'Pasarela ficticia del proyecto. No cobra dinero real. Cuenta WEB-DEMO exclusiva para simulaciones.',$entity)<=0)throw new RuntimeException('Could not save demo configuration');
 if(!$db->commit())throw new RuntimeException('Commit outcome unknown');
 echo json_encode(['ok'=>true,'demo_account'=>$aid,'methods'=>array_keys(demoPaymentMethods()),'real_money'=>false]).PHP_EOL;
}catch(Throwable $e){$db->query('ROLLBACK');$db->transaction_opened=0;fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
finally {if($demoSetupLocked)$db->query("SELECT RELEASE_LOCK('".$db->escape($demoSetupLock)."')");}
