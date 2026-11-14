<?php
// Read-only classification: recorded sale channel takes precedence over current customer data.
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
function salesNoteChannel($note,$prefix='portal-store-v1:') {
    if(!preg_match('/'.preg_quote($prefix,'/').'([A-Za-z0-9+\/=]+)/',$note ?? '',$m)) return null;
    $data=json_decode(base64_decode($m[1],true) ?: '',true);
    $channel=is_array($data) ? ($data['canal'] ?? null) : null;
    return in_array($channel,['b2b','b2c'],true) ? $channel : null;
}
function salesCustomerChannel($customer) {
    $channel=salesNoteChannel($customer['customer_note'] ?? null,'portal-customer-v1:');
    if($channel) return $channel;
    $type=$customer['customer_type'] ?? null;
    if($type==='TE_PRIVATE') return 'b2c';
    // These native classifications identify organizations; an unassigned type alone is not evidence.
    if(in_array($type,['TE_SMALL','TE_MEDIUM','TE_LARGE','TE_STARTUP','TE_GROUP'],true)) return 'b2b';
    if((int)($customer['customer_price_level'] ?? 0)===2) return 'b2b';
    return null;
}
function salesChannel($note,$customer,$relatedNotes=[]) {
    $channel=salesNoteChannel($note);
    if($channel) return ['canal'=>$channel,'fuenteCanal'=>'documento'];
    $frozen=salesNoteChannel($note,'academic-channel-v1:');
    if($frozen)return ['canal'=>$frozen,'fuenteCanal'=>'reconstruido'];
    $linked=[];
    foreach($relatedNotes as $related) { $c=salesNoteChannel($related); if($c) $linked[$c]=true; }
    if(count($linked)>1) return ['canal'=>null,'fuenteCanal'=>'conflicto'];
    if($linked) return ['canal'=>array_key_first($linked),'fuenteCanal'=>'vinculado'];
    $channel=salesCustomerChannel($customer);
    return ['canal'=>$channel,'fuenteCanal'=>$channel ? 'cliente' : 'sin_dato'];
}
