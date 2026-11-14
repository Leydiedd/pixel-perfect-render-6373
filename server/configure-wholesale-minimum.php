<?php
// Explicit CLI setup; later editable in Dolibarr Setup > Other setup (admin/const.php).
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
ini_set('display_errors','0'); ini_set('zend.exception_ignore_args','1');
require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
$portalMinimumAmount=$argv[3] ?? '';
if(($argv[1] ?? '')!=='--apply' || ($argv[2] ?? '')!==$dolibarr_main_db_name || !preg_match('/^\d{1,9}(\.\d{1,2})?$/D',$portalMinimumAmount)) { fwrite(STDERR,"Usage: php configure-wholesale-minimum.php --apply EXACT_DATABASE AMOUNT_WITHOUT_TAX\n"); exit(1); }
$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
require_once $dolibarr_main_document_root.'/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0 || !$user->admin || !$user->statut) { fwrite(STDERR,"Administrator required\n"); exit(1); }
$result=dolibarr_set_const($db,'BIMBO_B2B_MIN_SUBTOTAL_HT',$portalMinimumAmount,'chaine',1,'Tienda B2B: mínimo de productos a precio mayorista, sin IGV. Por debajo se usa precio normal. 0 desactiva el mínimo. Moneda de la empresa.',(int)$conf->entity);
if($result<=0) { fwrite(STDERR,"Could not save setting\n"); exit(1); }
echo json_encode(['ok'=>true,'minimum_without_tax'=>(float)$portalMinimumAmount,'editable_in'=>'admin/const.php']).PHP_EOL;
