<?php
// CLI-only cancellation of portal orders; documents and stock commit together.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors','0');
ini_set('zend.exception_ignore_args','1');
ob_start();
$cancelDb=null;$lockName=null;
class CancellationInputError extends RuntimeException {}
function cancellationRows($sql) {
    global $db;
    $r=$db->query($sql);
    if (!$r) throw new RuntimeException('Cancellation lookup failed: '.$db->lasterror());
    $rows=[];while($row=$db->fetch_object($r)) $rows[]=$row;
    return $rows;
}
function cancellationCheck($condition,$message) {
    if (!$condition) throw new CancellationInputError($message,409);
}
function cancellationFetch($object,$id) {
    if ($object->fetch($id)<=0) throw new RuntimeException('Cancellation object unavailable');
}
try {
    $raw=stream_get_contents(STDIN,8193);
    if (strlen($raw)>8192) throw new CancellationInputError('Solicitud demasiado grande.',400);
    $input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if (!is_array($input) || !is_int($input['pedidoId'] ?? null) || $input['pedidoId']<1 || !is_string($input['motivo'] ?? null) || mb_strlen(trim($input['motivo']))<3 || mb_strlen($input['motivo'])>500) throw new CancellationInputError('Selecciona el pedido e indica el motivo de cancelación (3 a 500 caracteres).',400);
    $reason=trim(strip_tags($input['motivo']));
    if (mb_strlen($reason)<3) throw new CancellationInputError('Indica un motivo de cancelación válido.',400);
    $config=getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
    require_once $config;
    $_ENV['dol_entity']=(int)(getenv('DOLIBARR_ENTITY') ?: 1);
    require_once $dolibarr_main_document_root.'/master.inc.php';
    $cancelDb=$db;
    if ($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1))<=0 || !$user->statut) throw new CancellationInputError('Usuario de integración no disponible.',403);
    $user->loadRights();
    foreach (['commande','facture','expedition'] as $module) if (!isModEnabled($module) || !$user->hasRight($module,'creer')) throw new CancellationInputError('Faltan permisos de pedidos, facturas o expediciones para cancelar.',403);
    if (!isModEnabled('stock') || !$user->hasRight('stock','mouvement','creer')) throw new CancellationInputError('Falta permiso para devolver stock.',403);
    require_once DOL_DOCUMENT_ROOT.'/commande/class/commande.class.php';
    require_once DOL_DOCUMENT_ROOT.'/compta/facture/class/facture.class.php';
    require_once DOL_DOCUMENT_ROOT.'/expedition/class/expedition.class.php';
    require_once DOL_DOCUMENT_ROOT.'/product/stock/class/mouvementstock.class.php';
    $entity=(int)$conf->entity;$id=$input['pedidoId'];$prefix=MAIN_DB_PREFIX;
    // Same mutex as creation prevents interleaving creation/cancellation/recovery.
    $lockName='bimbo-orders-'.substr(hash('sha256',$dolibarr_main_db_name.':'.$entity),0,40);
    $locked=cancellationRows("SELECT GET_LOCK('".$db->escape($lockName)."',10) acquired");
    if ((int)$locked[0]->acquired!==1) throw new CancellationInputError('Hay otra operación en curso. Reintenta en unos segundos.',503);
    if (!$db->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED') || !$db->begin()) throw new RuntimeException('Cancellation transaction failed');
    cancellationCheck(count(cancellationRows("SELECT rowid FROM {$prefix}commande WHERE rowid=$id AND entity=$entity FOR UPDATE"))===1,'El pedido no pertenece a esta entidad.');
    cancellationRows("SELECT rowid FROM {$prefix}commandedet WHERE fk_commande=$id FOR UPDATE");
    $order=new Commande($db);cancellationFetch($order,$id);
    cancellationCheck(empty($order->array_options['options_bimbo_fecha_entrega']) && !str_contains($order->note_private ?? '', 'portal-delivery-v1:'),'Este pedido ya fue entregado. Gestiona una devolución en lugar de cancelar la salida.');
    cancellationCheck(preg_match('/^WEB-[a-f0-9-]{36}$/i',$order->ref_ext ?? '') && preg_match('/portal-sha256:([a-f0-9]{64})/',$order->note_private ?? '',$hash),'Este pedido no fue creado por el portal. Gestiona su cancelación desde Dolibarr.');
    cancellationCheck(preg_match('/(?:^|\n)portal-stock-v1:(\d+):(\d+):(\d+)(?:\s|$)/',$order->note_private ?? '',$stockMarker),'Este pedido no tiene un descuento de stock trazable del portal. Revísalo en Dolibarr.');
    $warehouseId=(int)$stockMarker[1];$movementCount=(int)$stockMarker[2];$shipmentId=(int)$stockMarker[3];
    $ref=$db->escape($order->ref_ext);
    $invoiceLinks=cancellationRows("SELECT f.rowid FROM {$prefix}element_element ee JOIN {$prefix}facture f ON f.rowid=ee.fk_target WHERE ee.sourcetype='commande' AND ee.targettype='facture' AND ee.fk_source=$id FOR UPDATE");
    cancellationCheck(count($invoiceLinks)===1,'El pedido debe tener una única factura vinculada. Revisa su facturación en Dolibarr.');
    $fid=(int)$invoiceLinks[0]->rowid;
    cancellationRows("SELECT rowid FROM {$prefix}facturedet WHERE fk_facture=$fid FOR UPDATE");
    $invoice=new Facture($db);cancellationFetch($invoice,$fid);
    cancellationCheck((int)$invoice->entity===$entity && $invoice->ref_ext===$order->ref_ext && (int)$invoice->socid===(int)$order->socid && (int)$invoice->type===0 && str_contains($invoice->note_private ?? '', 'portal-sha256:'.$hash[1]),'La factura vinculada no corresponde al pedido original del portal.');
    $shipLinks=cancellationRows("SELECT fk_target FROM {$prefix}element_element WHERE sourcetype='commande' AND targettype='shipping' AND fk_source=$id FOR UPDATE");
    cancellationCheck(count($shipLinks)===($shipmentId ? 1 : 0) && (!$shipmentId || (int)$shipLinks[0]->fk_target===$shipmentId),'Las expediciones del pedido cambiaron. Revisa sus movimientos en Dolibarr.');
    $shipment=null;
    if ($shipmentId) {
        cancellationRows("SELECT rowid FROM {$prefix}expedition WHERE rowid=$shipmentId FOR UPDATE");
        cancellationRows("SELECT rowid FROM {$prefix}expeditiondet WHERE fk_expedition=$shipmentId FOR UPDATE");
        $shipment=new Expedition($db);cancellationFetch($shipment,$shipmentId);
        cancellationCheck((int)$shipment->entity===$entity && $shipment->ref_ext===$order->ref_ext,'La salida no corresponde al pedido original.');
    }
    $repeated=preg_match('/(?:^|\n)portal-cancel-v1:([A-Za-z0-9+\/=]+)(?:\s|$)/',$order->note_private ?? '',$done)===1;
    if ($repeated) {
        $result=json_decode(base64_decode($done[1],true),true,32,JSON_THROW_ON_ERROR);
        cancellationCheck((int)$order->status===-1 && (int)$invoice->status===3 && !$invoice->paye && (!$shipment || (int)$shipment->status===-1),'La cancelación ya se registró pero sus documentos cambiaron. No se volvió a devolver stock.');
        foreach ($result['stock']['lineas'] as $line) {
            $mid=(int)$line['movimientoId'];$rows=cancellationRows("SELECT fk_product,fk_entrepot,value,origintype,fk_origin FROM {$prefix}stock_mouvement WHERE rowid=$mid");
            cancellationCheck(count($rows)===1 && (int)$rows[0]->fk_product===$line['productoId'] && (int)$rows[0]->fk_entrepot===$warehouseId && $rows[0]->origintype==='shipping' && (int)$rows[0]->fk_origin===$shipmentId && abs((float)$rows[0]->value-$line['cantidad'])<0.0000001,'La devolución registrada cambió. Revísala en Dolibarr; no se repitió.');
        }
    } else {
        cancellationCheck(in_array((int)$order->status,[1,2,3],true) && (int)$invoice->status===1 && !$invoice->paye && (!$shipment || (int)$shipment->status===2),'El pedido, la factura o la salida cambiaron de estado. Revisa la cancelación en Dolibarr.');
        cancellationCheck(!$invoice->date_export && !$invoice->date_closing,'La factura ya está cerrada o exportada. Revisa su anulación en Dolibarr.');
        cancellationCheck(!cancellationRows("SELECT rowid FROM {$prefix}paiement_facture WHERE fk_facture=$fid FOR UPDATE"),'La factura tiene pagos registrados. Gestiona su devolución y anulación desde Dolibarr.');
        cancellationCheck(!cancellationRows("SELECT rowid FROM {$prefix}facture WHERE fk_facture_source=$fid FOR UPDATE"),'La factura tiene abonos o facturas sustitutas vinculadas. Revísala en Dolibarr.');
        cancellationCheck(!cancellationRows("SELECT rowid FROM {$prefix}societe_remise_except WHERE fk_facture=$fid OR fk_facture_source=$fid OR fk_facture_line IN (SELECT rowid FROM {$prefix}facturedet WHERE fk_facture=$fid) FOR UPDATE"),'La factura tiene anticipos o créditos aplicados. Revísala en Dolibarr.');
        if (isModEnabled('accounting') || cancellationRows("SHOW TABLES LIKE '".$db->escape($prefix."accounting_bookkeeping")."'")) {
            cancellationCheck(!cancellationRows("SELECT rowid FROM {$prefix}accounting_bookkeeping WHERE doc_type='facture_client' AND fk_doc=$fid AND entity=$entity FOR UPDATE"),'La factura ya está contabilizada. Gestiona su anulación desde Dolibarr.');
        }
        foreach (['total_ht','total_tva','total_ttc'] as $field) cancellationCheck(abs((float)$order->$field-(float)$invoice->$field)<0.005,'Los importes de la factura cambiaron. Revísala en Dolibarr.');
        $orderLines=[];$invoiceLines=[];
        foreach ($order->lines as $line) $orderLines[]=[(int)$line->fk_product,(float)$line->qty,(float)$line->subprice,(float)$line->tva_tx];
        foreach ($invoice->lines as $line) $invoiceLines[]=[(int)$line->fk_product,(float)$line->qty,(float)$line->subprice,(float)$line->tva_tx];
        sort($orderLines);sort($invoiceLines);
        cancellationCheck($orderLines===$invoiceLines,'Las líneas de la factura cambiaron. Revísala en Dolibarr.');
        $currentCanonical=['clienteId'=>(int)$order->socid,'lineas'=>$orderLines];
        if(preg_match('/portal-store-v1:([A-Za-z0-9+\/=]+)/',$order->note_private ?? '',$storeMarker)) {
            $storeMeta=json_decode(base64_decode($storeMarker[1]),true);
            cancellationCheck(is_array($storeMeta),'Los datos de la compra requieren revisión.');
            $currentCanonical['tienda']=$storeMeta;
        }
        $currentHash=hash('sha256',json_encode($currentCanonical));
        cancellationCheck(hash_equals($hash[1],$currentHash),'El pedido fue modificado después de su creación. Revisa la devolución en Dolibarr.');
        $outbound=$shipmentId ? cancellationRows("SELECT rowid,fk_product,fk_entrepot,value,batch FROM {$prefix}stock_mouvement WHERE origintype='shipping' AND fk_origin=$shipmentId ORDER BY fk_product,rowid FOR UPDATE") : [];
        cancellationCheck(count($outbound)===$movementCount,'Los movimientos de salida cambiaron. No se puede devolver stock automáticamente.');
        $warehouse=cancellationRows("SELECT rowid,ref FROM {$prefix}entrepot WHERE rowid=$warehouseId AND entity=$entity FOR UPDATE");
        cancellationCheck(count($warehouse)===1,'El almacén original ya no está disponible.');
        $plan=[];
        foreach ($outbound as $movement) {
            $pid=(int)$movement->fk_product;$quantity=-(float)$movement->value;
            cancellationCheck($quantity>0 && (int)$movement->fk_entrepot===$warehouseId && !$movement->batch && !isset($plan[$pid]),'La salida contiene movimientos modificados, lotes o devoluciones previas. Revísala en Dolibarr.');
            $original=array_values(array_filter($orderLines,fn($line)=>$line[0]===$pid));
            cancellationCheck(count($original)===1 && abs($original[0][1]-$quantity)<0.0000001,'La cantidad descontada no coincide con el pedido original.');
            cancellationRows("SELECT rowid FROM {$prefix}product WHERE rowid=$pid AND entity=$entity FOR UPDATE");
            $product=new Product($db);cancellationFetch($product,$pid);
            cancellationCheck($product->isStockManaged() && !$product->hasbatch(),'Cambió el control de stock del producto. Gestiona la devolución desde Dolibarr.');
            cancellationCheck(!cancellationRows("SELECT rowid FROM {$prefix}product_association WHERE fk_product_pere=$pid"),'El producto tiene componentes. Gestiona su devolución desde Dolibarr.');
            $balance=cancellationRows("SELECT rowid,reel FROM {$prefix}product_stock WHERE fk_product=$pid AND fk_entrepot=$warehouseId FOR UPDATE");
            $plan[$pid]=['productoId'=>$pid,'sku'=>$product->ref,'cantidad'=>$quantity,'antes'=>$balance ? (float)$balance[0]->reel : 0.0];
        }
        if ($shipment) {
            cancellationCheck(!cancellationRows("SELECT rowid FROM {$prefix}element_element WHERE sourcetype='shipping' AND fk_source=$shipmentId AND targettype='delivery' FOR UPDATE"),'La salida tiene una entrega vinculada. Gestiona la devolución desde Dolibarr.');
            $shipped=[];
            foreach ($shipment->lines as $line) {
                $pid=(int)$line->fk_product;
                if (isset($plan[$pid])) {
                    cancellationCheck((int)$line->entrepot_id===$warehouseId,'Cambió el almacén de la salida.');
                    $shipped[$pid]=($shipped[$pid] ?? 0)+(float)$line->qty;
                }
            }
            foreach ($plan as $pid=>$item) cancellationCheck(isset($shipped[$pid]) && abs($shipped[$pid]-$item['cantidad'])<0.0000001,'La cantidad expedida cambió. Revísala en Dolibarr.');
        }
        $returned=[];
        foreach ($plan as $pid=>$item) {
            $movement=new MouvementStock($db);
            $movement->setOrigin('shipping',$shipmentId);
            $mid=$movement->reception($user,$pid,$warehouseId,$item['cantidad'],0,'Devolución por cancelación '.$order->ref,'','','','',0,'WEB-CANCEL-'.$id,0,1);
            if ($mid<=0) throw new RuntimeException('Cancellation stock reception failed');
            $balance=cancellationRows("SELECT reel FROM {$prefix}product_stock WHERE fk_product=$pid AND fk_entrepot=$warehouseId");
            if (!$balance || abs((float)$balance[0]->reel-($item['antes']+$item['cantidad']))>0.0000001) throw new RuntimeException('Cancellation balance mismatch');
            $returned[]=['productoId'=>$pid,'sku'=>$item['sku'],'cantidad'=>$item['cantidad'],'movimientoId'=>(int)$mid];
        }
        // Keep original shipment lines and documents: Expedition::cancel() deletes them in v24.
        if ($shipment && $shipment->setStatusCommon($user,Expedition::STATUS_CANCELED,1)<=0) throw new RuntimeException('Shipment cancellation failed');
        $audit='Cancelación desde el portal · usuario '.$user->id.' · '.date('c').' · '.$reason;
        if ($shipment && $shipment->update_note(($shipment->note_private ?? '')."\n".$audit,'_private',1)<=0) throw new RuntimeException('Shipment cancellation audit failed');
        if ($invoice->setCanceled($user,Facture::CLOSECODE_ABANDONED,$audit)<=0) throw new RuntimeException('Invoice cancellation failed');
        if ($order->classifyUnBilled($user,1)<0 || $order->setStatut(Commande::STATUS_CANCELED,null,'','none')<=0) throw new RuntimeException('Order cancellation failed');
        cancellationFetch($order,$id);cancellationFetch($invoice,$fid);
        if ((int)$order->status!==-1 || (int)$invoice->status!==3) throw new RuntimeException('Cancellation final states invalid');
        foreach ($plan as $pid=>$item) {
            $balance=cancellationRows("SELECT reel FROM {$prefix}product_stock WHERE fk_product=$pid AND fk_entrepot=$warehouseId");
            if (!$balance || abs((float)$balance[0]->reel-($item['antes']+$item['cantidad']))>0.0000001) throw new RuntimeException('Final returned balance mismatch');
        }
        $result=['pedido'=>['id'=>$id,'ref'=>$order->ref,'estado'=>-1],'factura'=>['id'=>$fid,'ref'=>$invoice->ref,'estado'=>3],'stock'=>['almacen'=>['id'=>$warehouseId,'nombre'=>$warehouse[0]->ref],'lineas'=>$returned],'expedicion'=>$shipment ? ['id'=>$shipmentId,'ref'=>$shipment->ref,'estado'=>-1] : null,'motivo'=>$reason];
        $marker=base64_encode(json_encode($result,JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        if ($order->update_note($order->note_private."\n".$audit."\nportal-cancel-v1:".$marker,'_private',1)<=0) throw new RuntimeException('Cancellation marker failed');
    }
    if (!$db->commit()) throw new RuntimeException('Cancellation commit failed');
    $db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");$lockName=null;
    while(ob_get_level()) ob_end_clean();
    echo json_encode(['ok'=>true,'repetido'=>(bool)$repeated]+$result,JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    if ($cancelDb) {
        $cancelDb->query('ROLLBACK');$cancelDb->transaction_opened=0;
        if ($lockName) $cancelDb->query("SELECT RELEASE_LOCK('".$cancelDb->escape($lockName)."')");
    }
    while(ob_get_level()) ob_end_clean();
    if (!$e instanceof CancellationInputError) error_log('Portal cancellation: '.$e->getMessage());
    echo json_encode(['ok'=>false,'status'=>$e instanceof CancellationInputError ? $e->getCode() : 503,'error'=>$e instanceof CancellationInputError ? $e->getMessage() : 'No se pudo confirmar la cancelación. Reintenta el mismo pedido; no se duplicará la devolución.'],JSON_UNESCAPED_UNICODE);
}
