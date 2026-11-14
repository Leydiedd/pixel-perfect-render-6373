<?php
// Shared native pricing for storefront, admin quotations, and persisted order lines.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once DOL_DOCUMENT_ROOT.'/product/class/product.class.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/price.lib.php';

function portalPriceLevel($customer) {
    return getDolGlobalInt('PRODUIT_MULTIPRICES') ? max(1, (int)$customer->price_level) : 1;
}
function portalPriceLabel($level) {
    return getDolGlobalString('PRODUIT_MULTIPRICES_LABEL'.$level) ?: ($level===2 ? 'Mayorista B2B' : ($level===1 ? 'Normal B2C' : 'Tarifa '.$level));
}
function portalWholesaleMinimum() {
    $raw=getDolGlobalString('BIMBO_B2B_MIN_SUBTOTAL_HT','0');
    $value=str_replace(',','.',trim($raw));
    if(!preg_match('/^\d{1,9}(\.\d{1,2})?$/D',$value)) throw new RuntimeException('Invalid BIMBO_B2B_MIN_SUBTOTAL_HT setting');
    return (float)$value;
}
// Whole-order eligibility, using candidate wholesale amounts, rounded per line to cents.
function portalOrderPricing($customer,$candidates) {
    $assigned=portalPriceLevel($customer);
    $minimum=$assigned===2 ? portalWholesaleMinimum() : 0.0;
    $subtotalCents=0;
    foreach($candidates as $candidate) $subtotalCents+=(int)round($candidate['precio']*$candidate['cantidad']*100,0,PHP_ROUND_HALF_UP);
    $qualified=$assigned===2 && $subtotalCents >= (int)round($minimum*100);
    return ['nivelAsignado'=>$assigned,'nivelAplicado'=>$assigned===2 && !$qualified ? 1 : $assigned,'minimo'=>$minimum,'subtotalMayorista'=>$subtotalCents/100,'mayorista'=>$qualified];
}
function portalProductPrice($product, $customer) {
    global $mysoc;
    // Quantity-dependent and customer-specific rules need their own checkout support.
    foreach (['PRODUIT_CUSTOMER_PRICES','PRODUIT_CUSTOMER_PRICES_AND_MULTIPRICES','PRODUIT_CUSTOMER_PRICES_BY_QTY','PRODUIT_CUSTOMER_PRICES_BY_QTY_MULTIPRICES'] as $rule) {
        if (getDolGlobalInt($rule)) throw new RuntimeException('Unsupported pricing rule: '.$rule);
    }
    $price=$product->getSellPrice($mysoc, $customer);
    $amount=(float)$price['pu_ht']; $vat=(float)$price['tva_tx'];
    if (!is_finite($amount) || $amount<0 || !is_finite($vat) || $vat<0 || $vat>100 || !empty($price['tva_npr']) || !empty($price['localtax1']) || !empty($price['localtax2'])) throw new RuntimeException('Unsupported tax or price');
    return ['precio'=>$amount,'impuesto'=>$vat,'precioFinal'=>round($amount*(1+$vat/100),2)];
}

// A purchase channel changes this sale's tariff, never the stored customer identity or tier.
function portalCustomerForChannel($customer, $channel) {
    $priced=clone $customer;
    if(!in_array($channel,['b2c','b2b'],true)) return $priced;
    $consumer=false;
    if(preg_match('/portal-customer-v1:([A-Za-z0-9+\/=]+)/',$customer->note_private ?? '',$m)) {
        $meta=json_decode(base64_decode($m[1]),true); $consumer=($meta['canal'] ?? '')==='b2c';
    }
    if($channel==='b2c' || $consumer) $priced->price_level=1;
    return $priced;
}
