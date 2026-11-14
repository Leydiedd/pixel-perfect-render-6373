<?php
// Explicit local CLI provisioning. Never callable over HTTP; never prints passwords.
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
ini_set('display_errors','0'); ini_set('zend.exception_ignore_args','1');
$provisionOutput=$argv[3] ?? '';
require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
if(($argv[1] ?? '')!=='--apply' || ($argv[2] ?? '')!==$dolibarr_main_db_name || !$provisionOutput) { fwrite(STDERR,"Usage: --apply EXACT_DATABASE ABSOLUTE_PRIVATE_TEXT_FILE\n"); exit(1); }
$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
require_once $dolibarr_main_document_root.'/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/security2.lib.php';
function provisionRows($sql) { global $db; $r=$db->query($sql); if(!$r) throw new RuntimeException('Query failed'); $rows=[]; while($o=$db->fetch_object($r)) $rows[]=$o; return $rows; }
function provisionClean($s) { return trim(preg_replace('/[\r\n\x00-\x1f]+/u',' ',(string)$s)); }
$provisionLocked=false; $provisionFile=null; $provisionCreatedFile=false; $provisionCommitAttempted=false;
$provisionEntity=(int)$conf->entity; $provisionPrefix=MAIN_DB_PREFIX;
$provisionLock='bimbo-registration-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$provisionEntity),0,35);
try {
    if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0 || !$user->admin || !$user->statut || $user->socid) throw new RuntimeException('Active internal administrator required');
    $user->loadRights();
    if(!getDolGlobalString('DATABASE_PWD_ENCRYPTED')) throw new RuntimeException('Hashed password storage must be enabled');
    if(getDolGlobalString('MAIN_DEFAULT_WAREHOUSE_USER') && getDolGlobalString('STOCK_USERSTOCK_AUTOCREATE')) throw new RuntimeException('Automatic warehouses need separate review');
    $dir=realpath(dirname($provisionOutput));
    if(!$dir || !preg_match('/^[A-Za-z]:[\\\\\/]/',$provisionOutput) || strtolower(pathinfo($provisionOutput,PATHINFO_EXTENSION))!=='txt') throw new RuntimeException('Choose an existing private local folder and .txt file');
    foreach([DOL_DOCUMENT_ROOT, dirname(__DIR__)] as $blocked) {
        // If installed in server/, exclude the project tree. Workspace invocation is permitted.
        if($blocked===dirname(__DIR__) && basename(__DIR__)!=='server') continue;
        $base=strtolower(str_replace('\\','/',realpath($blocked) ?: $blocked)).'/';
        if(str_starts_with(strtolower(str_replace('\\','/',$dir)).'/',$base)) throw new RuntimeException('Credentials cannot be written into a served source tree');
    }
    if(file_exists($provisionOutput)) throw new RuntimeException('Credential file already exists; will not overwrite or reset passwords');
    if((int)(provisionRows("SELECT GET_LOCK('".$db->escape($provisionLock)."',10) acquired")[0]->acquired ?? 0)!==1) throw new RuntimeException('Another registration is in progress');
    $provisionLocked=true;
    $customers=provisionRows("SELECT rowid,nom,status,email,code_client FROM {$provisionPrefix}societe WHERE entity=$provisionEntity AND client IN(1,3) ORDER BY rowid");
    if(count($customers)!==80) throw new RuntimeException('Expected exactly the 80 existing customers; review current data');
    foreach($customers as $customer) {
        $id=(int)$customer->rowid; $login='cliente_'.str_pad((string)$id,4,'0',STR_PAD_LEFT);
        if((int)$customer->status!==1) throw new RuntimeException('Inactive customer '.$id);
        if(provisionRows("SELECT rowid FROM {$provisionPrefix}user WHERE entity IN(0,$provisionEntity) AND (fk_soc=$id OR login='".$db->escape($login)."') LIMIT 1")) throw new RuntimeException('Customer already linked or login collision: '.$id.'; no credentials changed');
        if(getDolGlobalString('USER_MAIL_REQUIRED') && !filter_var($customer->email,FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Email required for customer '.$id);
    }
    $provisionFile=fopen($provisionOutput,'x');
    if(!$provisionFile) throw new RuntimeException('Cannot reserve credential file');
    $provisionCreatedFile=true;
    $db->begin(); $credentials=[];
    foreach($customers as $customer) {
        $id=(int)$customer->rowid;
        $new=new User($db); $new->login='cliente_'.str_pad((string)$id,4,'0',STR_PAD_LEFT);
        $new->lastname=mb_substr(provisionClean($customer->nom),0,50); $new->email=trim($customer->email ?? '');
        $new->admin=0; $new->employee=0; $new->statut=1; $new->entity=$provisionEntity; $new->socid=$id;
        $password=rtrim(strtr(base64_encode(random_bytes(15)),'+/','-_'),'=').'Aa7!';
        if($new->create($user,1)<=0) throw new RuntimeException('Native user creation failed for customer '.$id);
        if(!is_string($new->setPassword($user,$password,0,1,1))) throw new RuntimeException('Native password assignment failed for customer '.$id);
        $uid=(int)$new->id;
        // Native User::create does not persist fk_soc; same linking as create_from_contact.
        if(!$db->query("UPDATE {$provisionPrefix}user SET fk_soc=$id,admin=0,employee=0 WHERE rowid=$uid AND entity=$provisionEntity")) throw new RuntimeException('External user link failed');
        if(!$db->query("DELETE FROM {$provisionPrefix}user_rights WHERE fk_user=$uid") || !$db->query("DELETE FROM {$provisionPrefix}usergroup_user WHERE fk_user=$uid")) throw new RuntimeException('Default privilege removal failed');
        $check=new User($db);
        if($check->fetch($uid)<=0 || (int)$check->socid!==$id || $check->admin || !$check->statut || !empty($check->pass_indatabase) || empty($check->pass_indatabase_crypted)) throw new RuntimeException('Account verification failed');
        $authenticated=checkLoginPassEntity($new->login,$password,$provisionEntity,['dolibarr'],'portal');
        if($authenticated!==$new->login) throw new RuntimeException('Native login verification failed for customer '.$id);
        $credentials[]=['id'=>$id,'name'=>provisionClean($customer->nom),'login'=>$new->login,'password'=>$password];
    }
    $text="BIMBO - ACCESOS DE LOS 80 CLIENTES\r\nDocumento privado para administración. No compartir el archivo completo con clientes.\r\nAcceso local: http://127.0.0.1:5173/acceso?destino=cuenta\r\nCada usuario está vinculado a su cliente de Dolibarr y puede consultar sus pedidos y facturas.\r\nNo tienen permisos de administración. La contraseña distingue mayúsculas y minúsculas.\r\nEntrega a cada cliente únicamente su propia credencial.\r\n";
    foreach($credentials as $c) $text.="\r\n------------------------------------------------------------\r\nCliente: {$c['name']}\r\nID Dolibarr: {$c['id']}\r\nUsuario: {$c['login']}\r\nContraseña: {$c['password']}\r\n";
    if(fwrite($provisionFile,"\xEF\xBB\xBF".$text)!==strlen("\xEF\xBB\xBF".$text) || !fflush($provisionFile)) throw new RuntimeException('Credential file write failed');
    if(function_exists('fsync') && !fsync($provisionFile)) throw new RuntimeException('Credential file sync failed');
    fclose($provisionFile); $provisionFile=null;
    $provisionCommitAttempted=true;
    if(!$db->commit()) throw new RuntimeException('Commit outcome uncertain: retain credential file and verify accounts; do not rerun');
    echo json_encode(['ok'=>true,'created'=>count($credentials),'native_logins_verified'=>count($credentials),'file'=>$provisionOutput],JSON_UNESCAPED_UNICODE).PHP_EOL;
} catch(Throwable $e) {
    $db->query('ROLLBACK'); $db->transaction_opened=0;
    if(is_resource($provisionFile)) fclose($provisionFile);
    if($provisionCreatedFile && !$provisionCommitAttempted) unlink($provisionOutput);
    fwrite(STDERR,$e->getMessage().PHP_EOL); exit(1);
} finally { if($provisionLocked) $db->query("SELECT RELEASE_LOCK('".$db->escape($provisionLock)."')"); }
