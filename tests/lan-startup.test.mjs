import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {selectLan,isPrivateIPv4,findPort} from '../scripts/lan-network.mjs';
const ip=address=>({address,family:'IPv4',internal:false});
test('Wi-Fi wins over VPN and VirtualBox; phone hotspot is discovered without fixed IP',()=>{
 const nets={'Wi-Fi':[ip('192.168.43.20')],'Ethernet 2':[ip('172.16.25.140')],'Ethernet 4':[ip('192.168.56.1')]};
 const adapters=[{name:'Wi-Fi',hardware:true,gateway:true},{name:'Ethernet 2',hardware:false,gateway:true},{name:'Ethernet 4',hardware:false}];
 assert.equal(selectLan(nets,adapters).address,'192.168.43.20');
 nets['Wi-Fi']=[ip('192.168.0.209')];assert.equal(selectLan(nets,adapters).address,'192.168.0.209');
});
test('USB tethering with gateway works and invalid/public/loopback addresses are excluded',()=>{
 assert.equal(selectLan({USB:[ip('172.20.10.2')]},[{name:'USB',hardware:true,gateway:true}]).address,'172.20.10.2');
 assert.equal(selectLan({lo:[{...ip('127.0.0.1'),internal:true}],bad:[ip('169.254.1.1')],wan:[ip('8.8.8.8')]}),null);
 for(const value of ['192.168.999.1','10.2.3','172.32.1.1','127.0.0.1'])assert.equal(isPrivateIPv4(value),false);
 assert.throws(()=>selectLan({WiFi:[ip('192.168.1.3')]},[],'192.168.1.99'));
 assert.equal(selectLan({WiFi:[ip('192.168.1.3')]},[],'192.168.1.3').address,'192.168.1.3');
});
test('port selection avoids listeners on IPv6 localhost and does not stop them',async()=>{
 const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'::1',port:0},resolve)});
 try {const port=server.address().port;const chosen=await findPort(port,port+3);assert.ok(chosen>port);assert.equal(server.listening,true);}
 finally{await new Promise(resolve=>server.close(resolve));}
});
