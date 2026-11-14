<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
function portalPickupPoint(){
 global $mysoc;
 $parts=[];foreach(['address','town'] as $key){$v=trim(preg_replace('/\s+/u',' ',strip_tags($mysoc->$key??'')));if($v!=='')$parts[]=$v;}
 return mb_substr(implode(' · ',$parts),0,255);
}

// Native commercial dates use Lima's calendar, independently of the PHP server timezone.
function portalBusinessDate(){
 $day=new DateTimeImmutable('now',new DateTimeZone('America/Lima'));
 return dol_mktime(12,0,0,(int)$day->format('m'),(int)$day->format('d'),(int)$day->format('Y'));
}
