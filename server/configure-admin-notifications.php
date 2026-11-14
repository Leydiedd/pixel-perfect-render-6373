<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');ini_set('zend.exception_ignore_args','1');
require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
if(($argv[1]??'')!=='--apply'||($argv[2]??'')!==$dolibarr_main_db_name){fwrite(STDERR,"Use --apply EXACT_DATABASE\n");exit(1);}
$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?:1);require_once $dolibarr_main_document_root.'/master.inc.php';
try{
 if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?:1))<=0||!$user->admin||!$user->statut||$user->socid)throw new RuntimeException('Administrator required');
 $p=MAIN_DB_PREFIX;
 foreach([
 "CREATE TABLE IF NOT EXISTS {$p}bimbo_admin_notification (rowid BIGINT NOT NULL AUTO_INCREMENT,entity INT NOT NULL,fk_soc INT NOT NULL,object_id INT NOT NULL,object_ref VARCHAR(128) NOT NULL,customer_name VARCHAR(255) NOT NULL,channel VARCHAR(3) NOT NULL,kind VARCHAR(20) NOT NULL,amount DECIMAL(24,8) NOT NULL,currency VARCHAR(3) NOT NULL,method VARCHAR(24) NULL,fk_paiement INT NULL,event_key VARCHAR(80) NOT NULL,created_at DATETIME NOT NULL,PRIMARY KEY(rowid),UNIQUE KEY uk_bimbo_admin_event(entity,event_key),KEY idx_bimbo_admin_entity(entity,rowid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
 "CREATE TABLE IF NOT EXISTS {$p}bimbo_admin_notification_read (fk_notification BIGINT NOT NULL,fk_user INT NOT NULL,read_at DATETIME NOT NULL,PRIMARY KEY(fk_notification,fk_user),KEY idx_bimbo_admin_reader(fk_user)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
 ] as $sql)if(!$db->query($sql))throw new RuntimeException('Could not configure administrator notifications');
 echo "Administrator notification tables configured; no historical events created\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
