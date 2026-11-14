import { networkInterfaces } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, createConnection } from 'node:net';
const execute = promisify(execFile);

export function isPrivateIPv4(address) {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}

export function selectLan(interfaces, adapters = [], preferred) {
  const candidates = Object.entries(interfaces).flatMap(([name, entries]) =>
    (entries ?? []).filter(i => !i.internal && (i.family === 'IPv4' || i.family === 4) && isPrivateIPv4(i.address))
      .map(i => {
        const info = adapters.find(a => a.name === name || (a.addresses ?? []).includes(i.address));
        const virtual = info?.hardware === false || /virtual|vpn|vethernet|vmware|virtualbox|loopback|docker|tailscale|wireguard|pangp/i.test(name + ' ' + (info?.description ?? ''));
        const wifi = /wi-?fi|wireless|wlan/i.test(name + ' ' + (info?.description ?? ''));
        return { name, address: i.address, virtual, score: (info?.gateway ? 100 : 0) + (info?.hardware ? 50 : 0) + (wifi ? 20 : 0) };
      }));
  if (preferred) {
    const chosen = candidates.find(c => c.address === preferred);
    if (!chosen) throw new Error('BIMBO_LAN_IP no corresponde a una IPv4 privada de este equipo.');
    return chosen;
  }
  return candidates.filter(c => !c.virtual).sort((a,b) => b.score-a.score || a.name.localeCompare(b.name))[0] ?? null;
}

export async function detectLan(preferred = process.env.BIMBO_LAN_IP) {
  let adapters = [];
  if (process.platform === 'win32') {
    try {
      const command = "$ErrorActionPreference='Stop'; @(Get-NetIPConfiguration | ForEach-Object { [pscustomobject]@{name=$_.InterfaceAlias; description=$_.NetAdapter.InterfaceDescription; hardware=[bool]$_.NetAdapter.HardwareInterface; addresses=@($_.IPv4Address.IPAddress); gateway=[bool]($_.IPv4DefaultGateway.NextHop | Where-Object {$_ -ne '0.0.0.0'})} }) | ConvertTo-Json -Depth 4 -Compress";
      const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide:true, timeout:15000 });
      const parsed = JSON.parse(stdout.replace(/^\uFEFF/, ''));
      adapters = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch { console.warn('No se pudo consultar los adaptadores de Windows; se usará la detección de red de Node.'); }
  }
  return selectLan(networkInterfaces(), adapters, preferred);
}

async function alreadyListening(host, port) {
  return new Promise(resolve => {
    const socket = createConnection({host,port});
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(400, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

export async function findPort(first = 5173, last = 5183, lanAddresses = []) {
  for (let port=first; port<=last; port++) {
    // Windows can allow wildcard binds alongside a specific loopback listener.
    // Probe both loopbacks and the LAN address so localhost never opens another app.
    const busy = await Promise.all(['::1','127.0.0.1',...lanAddresses].map(host => alreadyListening(host,port)));
    if (busy.some(Boolean)) continue;
    const available = await new Promise(resolve => {
      const server = createServer();
      server.once('error', error => {
        if (!['EADDRINUSE','EACCES'].includes(error.code)) console.warn(`Puerto ${port}: ${error.message}`);
        resolve(false);
      });
      server.listen({host:'::', port, ipv6Only:false, exclusive:true}, () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No hay un puerto disponible entre ${first} y ${last}. Cierra una instancia anterior de Bimbo.`);
}
