import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { detectLan, findPort } from './lan-network.mjs';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
let child;
let monitor;
try {
  await access('.output/server/index.mjs');
  const lan = await detectLan();
  const port = await findPort(5173, 5183, lan ? [lan.address] : []);
  const local = `http://localhost:${port}`;
  const origin = lan ? `http://${lan.address}:${port}` : '';
  const erpPath = '/Dolibar/Bimbo/htdocs';
  const erp = lan ? `http://${lan.address}:8081${erpPath}` : `http://127.0.0.1:8081${erpPath}`;
  const env = {...process.env, NITRO_HOST:'::', NITRO_PORT:String(port), BIMBO_LAN_ORIGIN:origin, DOLIBARR_LAN_URL:erp};
  child = spawn(process.execPath, ['.output/server/index.mjs'], {stdio:'inherit', windowsHide:true, env});
  let ended = false;
  child.on('error', error => { ended=true; console.error(`No se pudo iniciar la web: ${error.message}`); process.exitCode=1; });
  child.on('exit', code => { ended=true; clearInterval(monitor); process.exitCode=code ?? 1; });
  let ready = false;
  for (let attempt=0; attempt<40 && !ended; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {signal:AbortSignal.timeout(1500)});
      if (response.ok) { ready=true; break; }
    } catch {}
    await new Promise(r => setTimeout(r,250));
  }
  if (!ready) throw new Error('La web no terminó de iniciar. Revisa el error mostrado arriba.');
  const lines = [
    'BIMBO - SISTEMA INICIADO', '',
    `En esta laptop: ${local}`, `Administración: ${local}/admin`,
    `Alternativa local: http://127.0.0.1:${port}`, '',
    ...(lan ? [`Red detectada: ${lan.name} (${lan.address})`, `Desde tu celular: ${origin}`, `Admin desde celular: ${origin}/admin`, `Dolibarr desde celular: ${erp}/`] : ['No se detectó una red local física. La web funciona en esta laptop.', 'Conecta el Wi-Fi o el punto de acceso del celular y vuelve a iniciar.']),
    '', `Dolibarr local: http://127.0.0.1:8081${erpPath}/`,
    ...(port !== 5173 ? [`El puerto 5173 está ocupado. Se eligió ${port} sin detener otras aplicaciones.`] : []),
    '', 'Mantén esta ventana abierta. Para detener: Ctrl+C.',
    'Si cambias de Wi-Fi, detén con Ctrl+C y vuelve a abrir INICIAR-BIMBO.cmd.',
    'Apache y MySQL de XAMPP deben estar encendidos para los datos y documentos.',
    'Enlaces guardados en .local/enlaces-bimbo.txt.',
  ];
  await mkdir('.local', {recursive:true});
  await writeFile('.local/enlaces-bimbo.txt', lines.join('\r\n')+'\r\n');
  console.log('\n'+lines.join('\n')+'\n');
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/tienda`, {signal:AbortSignal.timeout(25000)});
    if (!response.ok) console.warn('La web arrancó, pero no responde el catálogo: comprueba MySQL y la configuración de Dolibarr.');
  } catch { console.warn('No se pudo comprobar el catálogo. Comprueba MySQL en XAMPP.'); }
  let warned=false;
  monitor=setInterval(() => {
    if (lan && !warned && !Object.values(networkInterfaces()).flat().some(i => i?.address===lan.address)) {
      warned=true;
      console.warn('\nLa IP de red cambió. Los enlaces del celular anteriores ya no son válidos. Pulsa Ctrl+C y vuelve a iniciar para detectar la nueva red.\n');
    }
  },10000);
  monitor.unref();
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { clearInterval(monitor); child.kill(signal); });
} catch (error) {
  console.error(`\nNo se pudo iniciar Bimbo: ${error.message}`);
  if (error.code==='ENOENT') console.error('Ejecuta npm ci y npm run build antes de iniciar.');
  clearInterval(monitor);
  child?.kill();
  process.exitCode=1;
}
