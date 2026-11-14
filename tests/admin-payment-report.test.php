<?php
require __DIR__.'/../server/admin-payment-report.php';
function expect($v,$label){if(!$v)throw new RuntimeException($label);}
foreach(['DEMCB','DEMYAP','DEMPLN'] as $code) expect(adminPaymentIsDemo(['code'=>$code]),'Demo method recognized');
expect(adminPaymentIsDemo(['code'=>'CB','account_ref'=>'WEB-DEMO']),'Demo bank recognized');
expect(adminPaymentIsDemo(['code'=>'CB','note'=>'portal-demo-payment-v1:abc']),'Demo audit survives method change');
expect(!adminPaymentIsDemo(['code'=>'VIR','account_ref'=>'BANCO','note'=>'ordinary']),'Unmarked record stays separate');
expect(adminPaymentMethodCode(['code'=>'DEMCB'])==='CB','Card filter combines methods');
expect(adminPaymentMethod(['code'=>'DEMYAP'])==='Yape','Wallet name');
echo "PASS payment classification and method normalization\n";
