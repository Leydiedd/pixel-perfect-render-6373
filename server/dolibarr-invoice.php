<?php
// Loaded only by the CLI order adapter, inside its transaction and idempotency lock.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

function invoiceForPortalOrder($order, $refExt, $hash, $user, $db) {
    global $conf;
    require_once DOL_DOCUMENT_ROOT.'/compta/facture/class/facture.class.php';
    $entity = (int)$conf->entity;
    $invoice = new Facture($db);
    $result = $db->query('SELECT rowid,note_private FROM '.MAIN_DB_PREFIX."facture WHERE entity=$entity AND ref_ext='".$db->escape($refExt)."'");
    if (!$result || $db->num_rows($result) > 1) throw new RuntimeException('Invoice identity lookup failed');
    $found = $db->fetch_object($result);
    $links = $db->query('SELECT f.rowid FROM '.MAIN_DB_PREFIX.'element_element ee JOIN '.MAIN_DB_PREFIX."facture f ON f.rowid=ee.fk_target WHERE ee.sourcetype='commande' AND ee.targettype='facture' AND ee.fk_source=".(int)$order->id." AND f.entity=$entity");
    if (!$links) throw new RuntimeException('Invoice link lookup failed');
    $linkedIds = [];
    while ($row = $db->fetch_object($links)) $linkedIds[] = (int)$row->rowid;
    if ($found) {
        if (!str_contains($found->note_private ?? '', 'portal-sha256:'.$hash) || !in_array((int)$found->rowid, $linkedIds, true)) throw new OrderInputError('La factura de esta solicitud requiere revisión en Dolibarr. No se generó otra factura.', 409);
        if ($invoice->fetch((int)$found->rowid) <= 0) throw new RuntimeException('Invoice fetch failed');
        // A later payment or closure does not make a retry create another invoice.
        if ((int)$invoice->socid !== (int)$order->socid || (int)$invoice->type !== Facture::TYPE_STANDARD || !in_array((int)$invoice->status, [1, 2], true)) throw new OrderInputError('La factura asociada cambió de estado. Revísala en Dolibarr; no se generó otra.', 409);
        return $invoice;
    }
    if ($linkedIds || $order->billed) throw new OrderInputError('Este pedido ya tiene facturación en Dolibarr. Revísala antes de emitir otra factura.', 409);
    if (!in_array((int)$order->status, [1, 2, 3], true)) throw new OrderInputError('El pedido debe estar validado para generar su factura.', 409);
    if (!$user->hasRight('facture', 'creer')) throw new OrderInputError('El usuario de integración no puede crear facturas.', 403);
    if (!isModEnabled('facture')) throw new OrderInputError('Activa el módulo Facturas en Dolibarr.', 409);
    if (getDolGlobalInt('STOCK_CALCULATE_ON_BILL') === 1) throw new OrderInputError('Dolibarr requiere un almacén para facturar y descontar existencias. Configura ese flujo antes de continuar.', 409);

    $invoice->type = Facture::TYPE_STANDARD;
    $invoice->date = portalBusinessDate();
    $invoice->source = 0;
    $invoice->socid = $order->socid;
    $invoice->ref_ext = $refExt;
    $invoice->note_private = 'Factura del pedido '.$order->ref.'. portal-sha256:'.$hash;
    if(preg_match('/portal-pricing-v1:([A-Za-z0-9+\/=]+)/',$order->note_private ?? '',$pricingMatch)) $invoice->note_private .= "\nportal-pricing-v1:".$pricingMatch[1];
    if(preg_match('/portal-store-v1:([A-Za-z0-9+\/=]+)/',$order->note_private ?? '',$storeMatch)) $invoice->note_private .= "\nportal-store-v1:".$storeMatch[1];
    $invoice->note_public=$order->note_public;
    $invoice->origin = $invoice->origin_type = 'commande';
    $invoice->origin_id = $order->id;
    $invoice->linked_objects = ['commande' => $order->id];
    $invoice->context['createfromclone'] = 1;
    foreach (['cond_reglement_id', 'mode_reglement_id', 'fk_account', 'fk_project', 'multicurrency_code', 'multicurrency_tx', 'fk_incoterms', 'location_incoterms'] as $field) $invoice->$field = $order->$field;
    $invoice->ref_customer = $order->ref_client;
    // Feed persisted order lines to native invoice creation. Never recompute from browser prices.
    foreach ($order->lines as $source) {
        $line = new FactureLigne($db);
        foreach (['label','desc','subprice','qty','tva_tx','vat_src_code','localtax1_tx','localtax2_tx','fk_product','remise_percent','info_bits','product_type','rang','special_code','fk_parent_line','fk_unit','date_start','date_end','fk_fournprice','pa_ht','multicurrency_subprice'] as $field) $line->$field = $source->$field;
        $line->element = 'commandedet';
        $line->id = $source->id;
        $invoice->lines[] = $line;
    }
    if ($invoice->create($user, 1) <= 0) throw new RuntimeException('Invoice creation failed: '.$invoice->error);
    if ($invoice->fetch($invoice->id) <= 0) throw new RuntimeException('Invoice fetch failed');
    if ($invoice->validate($user, '', 0, 1) <= 0) throw new RuntimeException('Invoice validation failed: '.$invoice->error);
    if ($invoice->fetch($invoice->id) <= 0 || (int)$invoice->status !== 1 || $invoice->paye || !trim($invoice->ref) || preg_match('/^[\(]?PROV/i', $invoice->ref)) throw new RuntimeException('Invoice validation state failed');
    foreach (['total_ht','total_tva','total_ttc'] as $field) {
        if (abs((float)$invoice->$field - (float)$order->$field) > 0.005) throw new RuntimeException('Invoice totals do not match the order');
    }
    if ($order->classifyBilled($user, 1) < 0) throw new RuntimeException('Could not mark order invoiced');
    return $invoice;
}

function portalInvoiceHasPdf($invoice) {
    global $dolibarr_main_data_root;
    if (empty($invoice->last_main_doc)) return false;
    $root = realpath($dolibarr_main_data_root);
    $path = realpath($dolibarr_main_data_root.'/'.$invoice->last_main_doc);
    return $root && $path && is_file($path) && strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'pdf' && strncasecmp(str_replace('\\', '/', $path), str_replace('\\', '/', $root).'/', strlen($root) + 1) === 0;
}

function ensurePortalInvoicePdf($invoice, $db) {
    global $langs, $conf;
    if (portalInvoiceHasPdf($invoice)) return true;
    // Generate only after the order and invoice are committed; a PDF failure never duplicates them.
    $previousErrorMode = $conf->global->TCPDF_THROW_ERRORS_INSTEAD_OF_DIE ?? null;
    $conf->global->TCPDF_THROW_ERRORS_INSTEAD_OF_DIE = '1';
    try {
        $invoice->fetch_thirdparty();
        if ($invoice->generateDocument('', $langs) <= 0) return false;
        $invoice->fetch($invoice->id);
        return portalInvoiceHasPdf($invoice);
    } catch (Throwable $e) {
        error_log('Bimbo invoice PDF could not be generated');
        return false;
    } finally {
        if ($previousErrorMode === null) unset($conf->global->TCPDF_THROW_ERRORS_INSTEAD_OF_DIE);
        else $conf->global->TCPDF_THROW_ERRORS_INSTEAD_OF_DIE = $previousErrorMode;
    }
}
