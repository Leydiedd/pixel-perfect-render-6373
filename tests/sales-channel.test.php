<?php
require __DIR__.'/../server/sales-channel.php';
function note($channel,$prefix='portal-store-v1:'){return $prefix.base64_encode(json_encode(['canal'=>$channel]));}
function same($actual,$expected,$message){if($actual!==$expected)throw new RuntimeException($message);echo "PASS $message\n";}
$biz=['customer_price_level'=>2];
same(salesChannel(note('b2c'),$biz),['canal'=>'b2c','fuenteCanal'=>'documento'],'home sale from business remains B2C');
same(salesChannel(null,$biz),['canal'=>'b2b','fuenteCanal'=>'cliente'],'legacy business is explicitly inferred from customer');
same(salesChannel(null,['customer_type'=>'TE_PRIVATE','customer_price_level'=>2]),['canal'=>'b2c','fuenteCanal'=>'cliente'],'private customer takes precedence over tariff');
same(salesChannel(null,['customer_note'=>note('b2c','portal-customer-v1:'),'customer_price_level'=>2]),['canal'=>'b2c','fuenteCanal'=>'cliente'],'registered consumer overrides price tier');
same(salesChannel(null,[]),['canal'=>null,'fuenteCanal'=>'sin_dato'],'unknown customer remains unclassified');
same(salesChannel(null,$biz,[note('b2c')]),['canal'=>'b2c','fuenteCanal'=>'vinculado'],'invoice inherits linked order or source invoice channel');
same(salesChannel(null,$biz,[note('b2c'),note('b2b')]),['canal'=>null,'fuenteCanal'=>'conflicto'],'mixed orders are not attributed to one channel');
same(salesChannel(note('b2c'),$biz,[note('b2b')]),['canal'=>'b2c','fuenteCanal'=>'documento'],'own document metadata wins');
same(salesChannel('portal-store-v1:bnVsbA==',[]),['canal'=>null,'fuenteCanal'=>'sin_dato'],'malformed metadata cannot invent a channel');
