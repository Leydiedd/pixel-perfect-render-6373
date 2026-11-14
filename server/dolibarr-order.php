<?php
// CLI only. Uses Dolibarr's business objects for atomic creation and validation.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
ini_set('zend.exception_ignore_args', '1');
ob_start();
$orderDb = null;
$lockName = null;
$revisable = false;
function replyOrder($payload) {
    while (ob_get_level()) ob_end_clean();
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
}
class OrderInputError extends RuntimeException {}
try {
    $raw = stream_get_contents(STDIN, 65537);
    if (strlen($raw) > 65536) throw new OrderInputError('El pedido es demasiado grande.', 400);
    $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !is_int($input['clienteId'] ?? null) || $input['clienteId'] < 1 ||
        !is_string($input['solicitudId'] ?? null) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i', $input['solicitudId']) ||
        !is_array($input['lineas'] ?? null) || count($input['lineas']) < 1 || count($input['lineas']) > 100) {
        throw new OrderInputError('Selecciona un cliente y al menos un producto válido.', 400);
    }
    $unique = [];
    foreach ($input['lineas'] as $line) {
        if (!is_array($line) || !is_int($line['productoId'] ?? null) || $line['productoId'] < 1 || isset($unique[$line['productoId']]) ||
            !is_numeric($line['cantidad'] ?? null) || !is_finite((float)$line['cantidad']) || $line['cantidad'] <= 0 || $line['cantidad'] > 1000000 ||
            abs(round((float)$line['cantidad'], 4) - (float)$line['cantidad']) > 0.0000001 ||
            !is_numeric($line['precioEsperado'] ?? null) || !is_numeric($line['impuestoEsperado'] ?? null)) {
            throw new OrderInputError('Revisa las cantidades: deben ser positivas, con un máximo de cuatro decimales, sin productos duplicados.', 400);
        }
        $unique[$line['productoId']] = true;
    }
    usort($input['lineas'], fn($a, $b) => $a['productoId'] <=> $b['productoId']);
    $canonical = ['clienteId' => $input['clienteId'], 'lineas' => array_map(fn($l) => [(int)$l['productoId'], (float)$l['cantidad'], (float)$l['precioEsperado'], (float)$l['impuestoEsperado']], $input['lineas'])];
    if(isset($input['tienda'])) $canonical['tienda']=$input['tienda'];
    $hash = hash('sha256', json_encode($canonical));
    $config = getenv('DOLIBARR_CONFIG_PATH') ?: 'C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php';
    require_once $config;
    $_ENV['dol_entity'] = (int)(getenv('DOLIBARR_ENTITY') ?: 1);
    require_once $dolibarr_main_document_root.'/master.inc.php';
    // Credentials and the chosen actor are server configuration, never request parameters.
    $orderDb = $db;
    if ($user->fetch((int)(getenv('DOLIBARR_USER_ID') ?: 1)) <= 0 || !$user->statut) throw new OrderInputError('El usuario de integración no está disponible.', 403);
    $user->loadRights();
    if (!$user->hasRight('commande', 'creer')) throw new OrderInputError('El usuario de integración no puede crear pedidos.', 403);
    if (!isModEnabled('commande')) throw new OrderInputError('Activa el módulo Pedidos en Dolibarr.', 409);
    // Order and invoice header workflows are skipped; shipments use native lifecycle triggers.
    // Core numbering, totals, permissions and status validation still run normally.
    require_once DOL_DOCUMENT_ROOT.'/commande/class/commande.class.php';
    require_once DOL_DOCUMENT_ROOT.'/product/class/product.class.php';
    require_once DOL_DOCUMENT_ROOT.'/core/lib/price.lib.php';
    require_once __DIR__.'/dolibarr-pricing.php';
    require_once __DIR__.'/dolibarr-invoice.php';
    require_once __DIR__.'/fulfillment.php';
    require_once __DIR__.'/dolibarr-stock.php';
    $entity = (int)$conf->entity;
    $refExt = 'WEB-'.strtolower($input['solicitudId']);
    // One lock also protects Dolibarr's numbering sequence across this portal's submissions.
    $lockName = 'bimbo-orders-'.substr(hash('sha256', $dolibarr_main_db_name.':'.$entity), 0, 40);
    $lockResult = $db->query("SELECT GET_LOCK('".$db->escape($lockName)."', 10) AS acquired");
    if (!$lockResult || (int)$db->fetch_object($lockResult)->acquired !== 1) throw new OrderInputError('Hay otro pedido guardándose. Reintenta en unos segundos.', 503);
    $existingResult = $db->query('SELECT rowid,note_private FROM '.MAIN_DB_PREFIX."commande WHERE entity=$entity AND ref_ext='".$db->escape($refExt)."'");
    if (!$existingResult) throw new RuntimeException('Lookup failed');
    $existing = $db->fetch_object($existingResult);
    $order = new Commande($db);
    $repeated = (bool)$existing;
    if (!$db->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED') || !$db->begin()) throw new RuntimeException('Transaction failed');
    require_once __DIR__.'/dolibarr-store-order.php';
    validateStoreOrder($db,$input,$entity);
    if ($existing) {
        if (!str_contains($existing->note_private ?? '', 'portal-sha256:'.$hash)) throw new OrderInputError('Esta solicitud ya se utilizó con otro contenido. Revisa el pedido guardado.', 409);
        if ($order->fetch((int)$existing->rowid) <= 0) throw new RuntimeException('Order lookup failed');
        if ((int)$order->status === -1 || str_contains($order->note_private ?? '', 'portal-cancel-v1:')) {
            $revisable = true;
            throw new OrderInputError('Este pedido fue cancelado. No se volvió a facturar ni a descontar stock. Para una venta nueva, crea otro pedido.', 409);
        }
        $stock = existingPortalStock($db, $order, $refExt);
    } else {
        $revisable = true;
        $customer = new Societe($db);
        if (!$db->query('SELECT rowid FROM '.MAIN_DB_PREFIX.'societe WHERE rowid='.(int)$input['clienteId'].' AND entity='.$entity.' FOR UPDATE')) throw new RuntimeException('Customer lock failed');
        if ($customer->fetch($input['clienteId']) <= 0 || (int)$customer->entity !== $entity || !in_array((int)$customer->client, [1, 3], true) || (int)$customer->status !== 1) throw new OrderInputError('Selecciona un cliente activo de Dolibarr.', 400);
        $customer=portalCustomerForChannel($customer,$input['tienda']['canal'] ?? null);
        $warehouse = portalSaleWarehouse($db, $user);
        $stockPlan = [];
        $prepared = [];
        $candidates = [];
        foreach ($input['lineas'] as $line) {
            if (!$db->query('SELECT rowid FROM '.MAIN_DB_PREFIX.'product WHERE rowid='.(int)$line['productoId'].' AND entity='.$entity.' FOR UPDATE')) throw new RuntimeException('Product lock failed');
            $product = new Product($db);
            if ($product->fetch($line['productoId']) <= 0 || (int)$product->entity !== $entity || !$product->status) throw new OrderInputError('Un producto ya no está disponible para la venta. Actualiza el catálogo.', 409);
            $nativePrice = portalProductPrice($product,$customer);
            $price = $nativePrice['precio'];
            if(isset($input['tienda']) && ($price<=0 || (int)$product->type!==0)) throw new OrderInputError('Este producto no tiene un precio de venta online disponible.',409);
            $vat = $nativePrice['impuesto'];
            $quantity = (float)$line['cantidad'];
            $stockItem = lockPortalStock($db, $product, $quantity, $warehouse);
            if ($stockItem) $stockPlan[] = $stockItem;
            $prepared[] = [$product, $quantity, $price, $vat];
            $candidates[] = ['precio'=>$price,'cantidad'=>$quantity];
        }
        $pricing=portalOrderPricing($customer,$candidates);
        $pricedCustomer=clone $customer; $pricedCustomer->price_level=$pricing['nivelAplicado'];
        foreach($prepared as $index=>[$product,$quantity,$price,$vat]) {
            if($pricing['nivelAplicado']!==$pricing['nivelAsignado']) {
                $effective=portalProductPrice($product,$pricedCustomer); $price=$effective['precio']; $vat=$effective['impuesto'];
            }
            $expected=$input['lineas'][$index];
            if(isset($input['tienda']) && $price<=0) throw new OrderInputError('El producto no tiene precio para la tarifa aplicable.',409);
            if(abs($price-(float)$expected['precioEsperado'])>0.000001 || abs($vat-(float)$expected['impuestoEsperado'])>0.000001) throw new OrderInputError('Cambió el precio, el impuesto o la condición mayorista de '.$product->ref.'. Actualiza y revisa el pedido antes de enviarlo.',409);
            $prepared[$index]=[$product,$quantity,$price,$vat];
        }
        $order->socid = $customer->id;
        $order->date = portalBusinessDate();
        $order->date_commande = $order->date;
        $order->source = 1;
        $order->ref_ext = $refExt;
        $order->warehouse_id = $warehouse['id'];
        $order->note_private = 'Creado desde el portal Bimbo. portal-sha256:'.$hash;
        $order->note_private .= "\nTarifa aplicada: ".portalPriceLabel($pricing['nivelAplicado']).' (nivel '.$pricing['nivelAplicado'].'). portal-pricing-v1:'.base64_encode(json_encode($pricing));
        if(isset($input['tienda'])) {
            $m=$input['tienda'];
            $order->note_private .= "\nCanal: ".strtoupper($m['canal']).". portal-store-v1:".base64_encode(json_encode($m, JSON_UNESCAPED_UNICODE));
            $e=$m['entrega'];
            $mode=$e['tipo']??'delivery';
            $order->array_options['options_bimbo_modalidad']=$mode;
            if($mode==='recojo'){
                require_once __DIR__.'/fulfillment.php';$point=portalPickupPoint();
                $order->array_options['options_bimbo_punto_recojo']=$point;
                $order->note_public='Recojo en tienda: '.$point.' | Retira: '.$e['contacto'].' | '.$e['telefono'];
            }else $order->note_public='Delivery: '.$e['contacto'].' | '.$e['telefono'].' | '.$e['direccion'].' | '.$e['ciudad'];
        }
        $order->cond_reglement_id = $customer->cond_reglement_id;
        $order->mode_reglement_id = $customer->mode_reglement_id;
        // Build lines through create(), which uses Dolibarr's addline and total calculation.
        foreach ($prepared as [$product, $quantity, $price, $vat]) {
            $line = new OrderLine($db);
            $line->fk_product = $product->id;
            $line->desc = $product->description ?: $product->label;
            $line->label = $product->label;
            $line->qty = $quantity;
            $line->subprice = $price;
            $line->price = $price;
            $line->price_base_type = 'HT';
            $line->tva_tx = $vat;
            $line->remise_percent = 0;
            $line->product_type = (int)$product->type;
            $line->fk_unit = $product->fk_unit;
            $order->lines[] = $line;
        }
        if ($order->create($user, 1) <= 0) throw new RuntimeException('Create failed: '.$order->error);
        if ($order->fetch($order->id) <= 0) throw new RuntimeException('Fetch failed');
        if ($order->valid($user, 0, 1) <= 0) throw new RuntimeException('Validation failed: '.$order->error);
        if ($order->fetch($order->id) <= 0 || (int)$order->status !== 1 || !trim($order->ref) || preg_match('/^[\(]?PROV/i', $order->ref)) throw new RuntimeException('Validation state or definitive reference failed');
        $invoice = invoiceForPortalOrder($order, $refExt, $hash, $user, $db);
        $stock = withdrawPortalStock($db, $user, $order, $warehouse, $stockPlan, $refExt);
        if ($order->fetch($order->id) <= 0) throw new RuntimeException('Final order lookup failed');
    }
    if ($existing) $invoice = invoiceForPortalOrder($order, $refExt, $hash, $user, $db);
    if(!$repeated && isset($input['tienda'])) {
        require_once __DIR__.'/admin-notifications.php';
        portalAdminNotification($order,'pedido_cliente',$input['solicitudId'],$input['tienda']['canal'],(float)$order->total_ttc);
    }
    if (!$db->commit()) throw new RuntimeException('Commit failed');
    $invoicePdf = ensurePortalInvoicePdf($invoice, $db);
    $warnings = [];
    if (!$invoicePdf) $warnings[] = 'El pedido y la factura están guardados. Puedes generar el PDF desde la ficha de la factura en Dolibarr.';
    if ($stock['estado'] === 'anterior') $warnings[] = 'Este pedido se creó antes del descuento automático. Se recuperó sin modificar su stock; revisa sus movimientos en Dolibarr.';
    $db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");
    $lockName = null;
    replyOrder(['ok' => true, 'pedido' => ['id' => (int)$order->id, 'ref' => $order->ref, 'estado' => (int)$order->status, 'subtotal' => (float)$order->total_ht, 'impuesto' => (float)$order->total_tva, 'total' => (float)$order->total_ttc], 'factura' => ['id' => (int)$invoice->id, 'ref' => $invoice->ref, 'estado' => (int)$invoice->status, 'pagada' => (bool)$invoice->paye, 'total' => (float)$invoice->total_ttc, 'pdf' => $invoicePdf], 'stock' => $stock, 'aviso' => $warnings ? implode(' ', $warnings) : null, 'repetido' => $repeated]);
} catch (Throwable $e) {
    if ($orderDb) {
        // Nested Dolibarr operations can leave more than one transaction level on failure.
        $orderDb->query('ROLLBACK');
        $orderDb->transaction_opened = 0;
        if ($lockName) $orderDb->query("SELECT RELEASE_LOCK('".$orderDb->escape($lockName)."')");
    }
    $status = $e instanceof OrderInputError ? $e->getCode() : 503;
    $message = $e instanceof OrderInputError ? $e->getMessage() : 'No se pudo confirmar el pedido y su factura. Reintenta con la misma solicitud; no se duplicarán.';
    if (!($e instanceof OrderInputError)) error_log('Bimbo order: '.get_class($e).' '.$e->getMessage());
    replyOrder(['ok' => false, 'status' => $status, 'error' => $message, 'revisable' => $revisable && $e instanceof OrderInputError]);
}
