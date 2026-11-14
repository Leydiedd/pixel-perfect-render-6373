<?php
require __DIR__.'/../server/order-payment-state.php';
function checkGate($ok,$message){if(!$ok)throw new RuntimeException($message);echo "PASS $message\n";}
$base=['invoice_id'=>1,'order_customer'=>99,'invoice_customer'=>99,'invoice_entity'=>1,'type'=>0,'fk_statut'=>2,'paye'=>1,'total_ttc'=>11.68,'paid'=>11.68,'credits'=>0];
checkGate(orderPaymentBlock([$base],1)===null,'fully paid native invoice permits handover');
foreach([['paid'=>0],['paid'=>5],['paid'=>11.67],['paye'=>0],['fk_statut'=>0],['fk_statut'=>3],['type'=>4],['invoice_entity'=>2],['invoice_customer'=>4],['paid'=>'bad']] as $change)checkGate(orderPaymentBlock([array_merge($base,$change)],1)!==null,'unpaid, partial, invalid or unrelated invoice blocks handover');
checkGate(orderPaymentBlock([],1)!==null,'missing invoice is blocked');
checkGate(orderPaymentBlock([array_merge($base,['type'=>2])],1)!==null,'credit note alone cannot authorize handover');
checkGate(orderPaymentBlock([$base,array_merge($base,['invoice_id'=>2,'paid'=>0])],1)!==null,'every linked sales invoice must be paid');
checkGate(orderPaymentBlock([$base,$base],1)===null,'duplicate links do not change balance');
checkGate(orderPaymentBlock([array_merge($base,['paid'=>5,'credits'=>6.68])],1)===null,'applied native credit contributes to settled balance');
checkGate(orderPaymentBlock([array_merge($base,['paid'=>11.679999999])],1)===null,'cent rounding does not create false debt');
