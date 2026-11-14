<?php
// One-time, explicit CLI migration. Never called by an HTTP endpoint.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors','0'); ini_set('zend.exception_ignore_args','1');
require getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
if (($argv[1] ?? '')!=='--apply' || ($argv[2] ?? '')!==$dolibarr_main_db_name || ($argv[3] ?? '')!=='10') { fwrite(STDERR,"Usage: php configure-wholesale.php --apply EXACT_DATABASE 10 (backup first)\n"); exit(1); }
$_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
require_once $dolibarr_main_document_root.'/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
require_once DOL_DOCUMENT_ROOT.'/product/class/product.class.php';
function pricingRows($sql) { global $db; $r=$db->query($sql); if(!$r) throw new RuntimeException('Query failed'); $out=[]; while($o=$db->fetch_object($r)) $out[]=$o; return $out; }
$entity=(int)$conf->entity; $p=MAIN_DB_PREFIX; $locked=false;
$lock='bimbo-orders-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,40);
try {
    if($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0 || !$user->admin || !$user->statut) throw new RuntimeException('Administrator required');
    $user->loadRights();
    if((int)(pricingRows("SELECT GET_LOCK('".$db->escape($lock)."',10) acquired")[0]->acquired ?? 0)!==1) throw new RuntimeException('Busy');
    $locked=true;
    if(getDolGlobalString('BIMBO_WHOLESALE_INITIALIZED')) { echo "Already initialized; existing prices were not overwritten.\n"; exit; }
    foreach(['PRODUIT_MULTIPRICES','PRODUIT_CUSTOMER_PRICES','PRODUIT_CUSTOMER_PRICES_AND_MULTIPRICES','PRODUIT_CUSTOMER_PRICES_BY_QTY','PRODUIT_CUSTOMER_PRICES_BY_QTY_MULTIPRICES'] as $rule) if(getDolGlobalInt($rule)) throw new RuntimeException('Existing price rules require manual migration');
    $products=pricingRows("SELECT rowid,ref,price,price_ttc,price_min,price_min_ttc,price_base_type,tva_tx,cost_price FROM {$p}product WHERE entity=$entity ORDER BY rowid");
    if(pricingRows("SELECT rowid FROM {$p}product_price WHERE entity=$entity AND price_level>1 LIMIT 1")) throw new RuntimeException('Existing tiers must not be overwritten');
    foreach($products as $row) {
        $last=pricingRows("SELECT price FROM {$p}product_price WHERE entity=$entity AND fk_product=".(int)$row->rowid." AND price_level=1 ORDER BY date_price DESC,rowid DESC LIMIT 1");
        if(!$last || abs((float)$last[0]->price-(float)$row->price)>0.000001) throw new RuntimeException('Default price history mismatch: '.$row->ref);
        if($row->price>0 && (round($row->price*0.9,2)<(float)$row->price_min || round($row->price*0.9,2)<(float)$row->cost_price)) throw new RuntimeException('Wholesale below minimum or registered cost: '.$row->ref);
    }
    $db->begin();
    foreach(['PRODUIT_MULTIPRICES'=>1,'PRODUIT_MULTIPRICES_LIMIT'=>2,'PRODUCT_PRICE_UNIQ'=>0,'PRODUIT_MULTIPRICES_LABEL1'=>'Normal B2C','PRODUIT_MULTIPRICES_LABEL2'=>'Mayorista B2B'] as $key=>$value) {
        if(dolibarr_set_const($db,$key,$value,'chaine',0,'', $entity)<=0) throw new RuntimeException('Setting failed');
        $conf->global->$key=$value;
    }
    $updated=0;
    foreach($products as $row) {
        if($row->price<=0) continue; // No invented prices for raw materials.
        $product=new Product($db); if($product->fetch((int)$row->rowid)<=0) throw new RuntimeException('Product missing');
        $taxes=[$product->localtax1_type,$product->localtax1_tx,$product->localtax2_type,$product->localtax2_tx];
        if($product->updatePrice(round((float)$row->price*0.9,2),'HT',$user,$product->tva_tx,$product->price_min,2,$product->tva_npr,0,1,$taxes,$product->default_vat_code,'Tarifa mayorista inicial: 10% sobre precio normal',1)<0) throw new RuntimeException('Price update failed: '.$product->ref);
        $updated++;
    }
    $b2b=0; $b2c=0;
    foreach(pricingRows("SELECT s.rowid,s.note_private,t.code FROM {$p}societe s LEFT JOIN {$p}c_typent t ON t.id=s.fk_typent WHERE s.entity=$entity AND s.client IN (1,3)") as $row) {
        $channel=$row->code==='TE_PRIVATE' ? 'b2c' : 'b2b';
        if(preg_match('/portal-customer-v1:([A-Za-z0-9+\/=]+)/',$row->note_private ?? '',$m)) $channel=json_decode(base64_decode($m[1]),true)['canal'] ?? $channel;
        $soc=new Societe($db); if($soc->fetch((int)$row->rowid)<=0 || $soc->setPriceLevel($channel==='b2c' ? 1 : 2,$user)<=0) throw new RuntimeException('Customer level update failed');
        if($channel==='b2c') $b2c++; else $b2b++;
    }
    $after=pricingRows("SELECT rowid,ref,price,price_ttc,price_min,price_min_ttc,price_base_type,tva_tx,cost_price FROM {$p}product WHERE entity=$entity ORDER BY rowid");
    if(json_encode($products)!==json_encode($after)) throw new RuntimeException('Original B2C prices changed; rollback');
    if(dolibarr_set_const($db,'BIMBO_WHOLESALE_INITIALIZED','10-percent-initial','chaine',0,'', $entity)<=0) throw new RuntimeException('Migration marker failed');
    if(!$db->commit()) throw new RuntimeException('Commit failed');
    echo json_encode(['ok'=>true,'wholesale_products'=>$updated,'b2b_customers'=>$b2b,'b2c_customers'=>$b2c,'normal_prices_unchanged'=>true]).PHP_EOL;
} catch(Throwable $e) { $db->query('ROLLBACK'); $db->transaction_opened=0; fwrite(STDERR,$e->getMessage().PHP_EOL); exit(1); }
finally { if($locked) $db->query("SELECT RELEASE_LOCK('".$db->escape($lock)."')"); }
