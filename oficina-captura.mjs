// Captura real de La Oficina con Brave headless (1600x1000).
// Uso: node oficina-captura.mjs <salida.png> [--incidente]
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || 'oficina-shot5.png';
const wantIncident = process.argv.includes('--incidente');
const URL = 'http://localhost:8000/oficina-local.html';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: 'new',
  args: [
    '--window-size=1600,1000',
    '--hide-scrollbars',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check'
  ],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 }
});

const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#stageWrap canvas', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 3500));

// Dos tarjetas de permiso visibles a la vez.
await page.click('#simPermBtn');
await new Promise((r) => setTimeout(r, 700));
await page.click('#simPermBtn');
await new Promise((r) => setTimeout(r, 900));

// Incidente (solo presentación, para revisar la barra compacta).
if (wantIncident) {
  await page.evaluate(() => {
    const b = document.getElementById('incidentBanner');
    b.hidden = false;
    document.getElementById('incidentWhy').textContent =
      'Migración de rutinas falló dos veces y el deploy quedó a medias en producción; el equipo está revisando el SaveQueue y las RLS de clientes antes de reintentar.';
    document.getElementById('incidentTimer').textContent = '04:12';
  });
  await new Promise((r) => setTimeout(r, 400));
}

const metrics = await page.evaluate(() => {
  const stack = document.getElementById('permStack');
  const cards = [...document.querySelectorAll('.perm-card')];
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }; };
  return {
    stack: { ...box(stack), clientH: stack.clientHeight, scrollH: stack.scrollHeight, overflowY: getComputedStyle(stack).overflowY, maxH: getComputedStyle(stack).maxHeight },
    cards: cards.map(box),
    banner: document.getElementById('incidentBanner').hidden ? null : (() => { const b = document.getElementById('incidentBanner'); const cs = getComputedStyle(b); return { ...box(b), wrap: cs.flexWrap, rows: b.getClientRects().length }; })(),
    viewport: { w: innerWidth, h: innerHeight }
  };
});
console.log(JSON.stringify(metrics, null, 2));

await page.screenshot({ path: out });
console.log('captura:', out);
await browser.close();
