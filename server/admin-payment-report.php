<?php
// Presentation-only classification. Unmarked records are not bank verification.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function adminPaymentIsDemo($row) {
 return in_array($row['code'] ?? '', ['DEMCB','DEMYAP','DEMPLN'], true)
  || ($row['account_ref'] ?? '') === 'WEB-DEMO'
  || str_contains($row['note'] ?? '', 'portal-demo-payment-v1:');
}
function adminPaymentMethod($row) {
 $names=['LIQ'=>'Efectivo','VIR'=>'Transferencia bancaria','CB'=>'Tarjeta','CHQ'=>'Cheque','PRE'=>'Domiciliación','DEMCB'=>'Tarjeta','DEMYAP'=>'Yape','DEMPLN'=>'Plin'];
 return $names[$row['code'] ?? ''] ?? ($row['libelle'] ?: 'No registrado');
}
function adminPaymentMethodCode($row) {
 return ['DEMCB'=>'CB','DEMYAP'=>'YAPE','DEMPLN'=>'PLIN'][$row['code'] ?? ''] ?? ($row['code'] ?: 'SIN_MEDIO');
}
