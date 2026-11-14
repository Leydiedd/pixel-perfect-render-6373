<?php
// Stock changes use Dolibarr's movement object and the enclosing order transaction.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

function portalSaleWarehouse($db, $user) {
    global $conf;
    if (!isModEnabled('stock') || !$user->hasRight('stock', 'mouvement', 'creer')) throw new OrderInputError('El usuario de integración necesita el módulo Stock y permiso para crear movimientos.', 403);
    if (!isModEnabled('expedition') || !$user->hasRight('expedition', 'creer')) throw new OrderInputError('El usuario de integración necesita permiso para crear expediciones.', 403);
    foreach (['STOCK_CALCULATE_ON_VALIDATE_ORDER','STOCK_CALCULATE_ON_BILL'] as $flag) {
        if (getDolGlobalInt($flag)) throw new OrderInputError('Hay otro descuento automático de stock activado en Dolibarr. Revisa esa configuración antes de usar el descuento inmediato del portal.', 409);
    }
    if ((int)(bool)getDolGlobalInt('STOCK_CALCULATE_ON_SHIPMENT') + (int)(bool)getDolGlobalInt('STOCK_CALCULATE_ON_SHIPMENT_CLOSE') !== 1) throw new OrderInputError('Configura un único descuento de stock en Dolibarr: al validar o al cerrar la expedición.', 409);
    $id = getenv('DOLIBARR_WAREHOUSE_ID') ?: '1';
    if (!ctype_digit($id) || (int)$id < 1) throw new OrderInputError('El almacén de venta del portal no está configurado correctamente.', 409);
    $r = $db->query('SELECT rowid,ref FROM '.MAIN_DB_PREFIX.'entrepot WHERE rowid='.(int)$id.' AND entity='.(int)$conf->entity.' AND statut=1 FOR UPDATE');
    $row = $r ? $db->fetch_object($r) : null;
    if (!$row) throw new OrderInputError('El almacén de venta no está activo en Dolibarr.', 409);
    return ['id'=>(int)$row->rowid,'nombre'=>$row->ref];
}

function lockPortalStock($db, $product, $quantity, $warehouse) {
    if (!$product->isStockManaged()) return null;
    if ($product->hasbatch()) throw new OrderInputError('El producto '.$product->ref.' requiere elegir un lote. Gestiona esa salida desde Dolibarr.', 409);
    if (getDolGlobalInt('PRODUIT_SOUSPRODUITS') && $product->hasFatherOrChild(1)) throw new OrderInputError('El producto '.$product->ref.' tiene componentes. Gestiona su salida desde Dolibarr.', 409);
    // Lock the exact warehouse balance until order, movements and invoice are committed.
    $r = $db->query('SELECT rowid,reel FROM '.MAIN_DB_PREFIX.'product_stock WHERE fk_product='.(int)$product->id.' AND fk_entrepot='.(int)$warehouse['id'].' FOR UPDATE');
    if (!$r) throw new RuntimeException('Stock balance lookup failed');
    $row = $db->fetch_object($r);
    $available = $row ? (float)$row->reel : 0.0;
    if ($quantity > $available + 0.0000001) throw new OrderInputError('Stock insuficiente para '.$product->ref.' en '.$warehouse['nombre'].'. Disponible: '.$available.'. Actualiza las cantidades.', 409);
    return ['productoId'=>(int)$product->id,'sku'=>$product->ref,'cantidad'=>$quantity,'antes'=>$available];
}

function withdrawPortalStock($db, $user, $order, $warehouse, $plan, $refExt) {
    require_once DOL_DOCUMENT_ROOT.'/expedition/class/expedition.class.php';
    $shipment = null;
    if ($plan) {
        $shipment = new Expedition($db);
        $shipment->socid = $order->socid;
        $shipment->date_shipping = portalBusinessDate();
        $shipment->origin = $shipment->origin_type = 'commande';
        $shipment->origin_id = $order->id;
        $shipment->ref_ext = $refExt;
        $shipment->note_private = 'Salida automática del pedido web '.$order->ref;
        foreach ($order->lines as $line) {
            if ((int)$line->product_type === 0 || getDolGlobalInt('STOCK_SUPPORTS_SERVICES')) {
                if ($shipment->addline($warehouse['id'], $line->id, $line->qty, [], $line->fk_product) <= 0) throw new RuntimeException('Shipment line failed: '.$shipment->error);
            }
        }
        // Dolibarr 24's create() only commits its nested transaction when triggers run.
        if ($shipment->create($user, 0) <= 0 || $shipment->fetch($shipment->id) <= 0) throw new RuntimeException('Shipment creation failed: '.$shipment->error);
        if ($shipment->valid($user, 1) <= 0 || $shipment->fetch($shipment->id) <= 0 || !trim($shipment->ref) || preg_match('/^[\(]?PROV/i', $shipment->ref)) throw new RuntimeException('Shipment validation failed: '.$shipment->error);
        // Close without ORDER_CLOSE triggers: the invoice is already created explicitly by the portal.
        if ($order->cloture($user, 1, 0) < 0) throw new RuntimeException('Order closure failed');
        if ($shipment->setClosed() <= 0 || $shipment->fetch($shipment->id) <= 0 || (int)$shipment->status !== 2) throw new RuntimeException('Shipment closure failed: '.$shipment->error);
    }
    foreach ($plan as $item) {
        $r = $db->query('SELECT reel FROM '.MAIN_DB_PREFIX.'product_stock WHERE fk_product='.$item['productoId'].' AND fk_entrepot='.$warehouse['id']);
        $balance = $r ? $db->fetch_object($r) : null;
        $after = $balance ? (float)$balance->reel : 0.0;
        if (!$r || abs($after - ($item['antes'] - $item['cantidad'])) > 0.0000001 || $after < -0.0000001) throw new RuntimeException('Stock balance after movement is invalid');
    }
    // Durable completion marker, including service-only orders with no movement rows.
    $note = $order->note_private."\nportal-stock-v1:".$warehouse['id'].':'.count($plan).':'.($shipment ? $shipment->id : 0);
    if ($order->update_note($note, '_private', 1) <= 0) throw new RuntimeException('Stock completion marker failed');
    $stock = existingPortalStock($db, $order, $refExt);
    foreach ($plan as $item) {
        $actual = array_values(array_filter($stock['lineas'], fn($line) => $line['productoId'] === $item['productoId']));
        if (count($actual) !== 1 || abs($actual[0]['cantidad'] - $item['cantidad']) > 0.0000001) throw new RuntimeException('Shipment movements differ from the order');
    }
    return $stock;
}

function existingPortalStock($db, $order, $refExt) {
    global $conf;
    if (!preg_match('/(?:^|\n)portal-stock-v1:(\d+):(\d+):(\d+)(?:\s|$)/', $order->note_private ?? '', $marker)) return ['estado'=>'anterior','almacen'=>null,'lineas'=>[],'expedicion'=>null];
    $shipmentId = (int)$marker[3];
    $shipment = null;
    if (!$shipmentId && (int)$marker[2] === 0) return ['estado'=>'sin_productos','almacen'=>null,'lineas'=>[],'expedicion'=>null];
    if ($shipmentId) {
        $r = $db->query('SELECT e.rowid,e.ref,e.fk_statut FROM '.MAIN_DB_PREFIX.'expedition e JOIN '.MAIN_DB_PREFIX."element_element ee ON ee.fk_target=e.rowid AND ee.targettype='shipping' AND ee.sourcetype='commande' WHERE e.entity=".(int)$conf->entity.' AND e.rowid='.$shipmentId.' AND ee.fk_source='.(int)$order->id." AND e.ref_ext='".$db->escape($refExt)."'");
        $row = $r ? $db->fetch_object($r) : null;
        if (!$row || (int)$row->fk_statut !== 2) throw new OrderInputError('La salida del pedido requiere revisión en Dolibarr. No se volvió a descontar stock.', 409);
        $shipment = ['id'=>(int)$row->rowid,'ref'=>$row->ref,'estado'=>(int)$row->fk_statut];
    }
    $r = $db->query('SELECT m.rowid,m.fk_product,m.value,m.fk_entrepot,e.ref warehouse,p.ref sku FROM '.MAIN_DB_PREFIX.'stock_mouvement m JOIN '.MAIN_DB_PREFIX.'entrepot e ON e.rowid=m.fk_entrepot JOIN '.MAIN_DB_PREFIX."product p ON p.rowid=m.fk_product WHERE e.entity=".(int)$conf->entity." AND m.origintype='shipping' AND m.fk_origin=".$shipmentId.' ORDER BY m.rowid');
    if (!$r) throw new RuntimeException('Existing stock movements lookup failed');
    $lines = [];
    $warehouse = ['id'=>(int)$marker[1], 'nombre'=>'Almacén '.$marker[1]];
    while ($row = $db->fetch_object($r)) {
        if ((int)$row->fk_entrepot !== $warehouse['id'] || (float)$row->value >= 0) throw new OrderInputError('Los movimientos de este pedido cambiaron. Revísalos en Dolibarr; no se volvió a descontar stock.', 409);
        $warehouse['nombre'] = $row->warehouse;
        $lines[] = ['productoId'=>(int)$row->fk_product,'sku'=>$row->sku,'cantidad'=>-(float)$row->value,'movimientoId'=>(int)$row->rowid];
    }
    if (count($lines) !== (int)$marker[2]) throw new OrderInputError('Faltan movimientos del pedido. Revísalos en Dolibarr; no se volvió a descontar stock.', 409);
    return ['estado'=>$lines ? 'descontado' : 'sin_productos','almacen'=>$warehouse,'lineas'=>$lines,'expedicion'=>$shipment];
}
