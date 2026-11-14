<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
// Recheck authenticated customer inside the same transaction as the order.
function validateStoreOrder($db, $input, $entity) {
    $meta=$input['tienda'] ?? null;
    if($meta===null) return;
    if(!is_array($meta) || !is_int($meta['usuarioId'] ?? null) || !in_array($meta['canal'] ?? '',['b2b','b2c'],true)) throw new OrderInputError('Cuenta de cliente inválida.',403);
    $p=MAIN_DB_PREFIX; $uid=(int)$meta['usuarioId']; $cid=(int)$input['clienteId'];
    $r=$db->query("SELECT u.fk_soc,u.statut,s.note_private,s.status,s.client FROM {$p}user u JOIN {$p}societe s ON s.rowid=u.fk_soc WHERE u.rowid=$uid AND u.entity=$entity AND s.entity=$entity FOR UPDATE");
    $row=$r ? $db->fetch_object($r) : null;
    if(!$row || (int)$row->fk_soc!==$cid || !$row->statut || !$row->status || !in_array((int)$row->client,[1,3],true)) throw new OrderInputError('El cliente no está habilitado para comprar.',403);
    $channel='b2b';
    if(preg_match('/portal-customer-v1:([A-Za-z0-9+\/=]+)/',$row->note_private ?? '',$m)) { $saved=json_decode(base64_decode($m[1]),true); if(($saved['canal'] ?? '')==='b2c') $channel='b2c'; }
    if($channel==='b2c' && $meta['canal']==='b2b') throw new OrderInputError('La compra mayorista requiere una cuenta de negocio.',403);
    $pickup=($meta['entrega']['tipo']??'delivery')==='recojo';
    if(!in_array($meta['entrega']['tipo']??'delivery',['delivery','recojo'],true))throw new OrderInputError('Modalidad inválida.',400);
    require_once __DIR__.'/fulfillment.php';
    if($pickup&&!portalPickupPoint())throw new OrderInputError('El punto de recojo todavía no está configurado en Dolibarr.',409);
    foreach($pickup?['contacto','telefono']:['contacto','telefono','direccion','ciudad'] as $f) if(!is_string($meta['entrega'][$f] ?? null) || strlen(trim($meta['entrega'][$f]))<2 || strlen($meta['entrega'][$f])>600 || preg_match('/[<>\x00-\x1f]/',$meta['entrega'][$f])) throw new OrderInputError('Completa la dirección de entrega.',400);
    foreach($input['lineas'] as $line) if(floor($line['cantidad'])!=$line['cantidad']) throw new OrderInputError('La tienda vende unidades completas.',400);
}
