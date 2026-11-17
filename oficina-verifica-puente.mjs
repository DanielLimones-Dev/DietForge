// Verificación real de La Oficina contra el puente 8001 (Brave headless).
// Uso: node oficina-verifica-puente.mjs <salida.png>
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || 'oficina-shot-20261116-puente-en-vivo.png';
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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const failed = [];
page.on('requestfailed', (r) => failed.push(r.url()));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#stageWrap canvas', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 8000));

const status = await page.evaluate(() => ({
  liveText: document.getElementById('liveText')?.textContent,
  liveMeta: document.getElementById('liveMeta')?.textContent,
  chatLive: document.getElementById('chatLiveStatus')?.textContent,
  chatLiveClass: document.getElementById('chatLiveStatus')?.className,
  meter: document.getElementById('meterStatus')?.textContent,
  agora: [...document.querySelectorAll('.agent-live-tag')].slice(0, 3).map((e) => e.textContent),
  liveTags: [...document.querySelectorAll('.live-tag.on')].map((e) => (e.closest('.agent-row')?.innerText || e.parentElement?.innerText || '').replace(/\s+/g, ' ').slice(0, 80))
}));

await page.screenshot({ path: out, fullPage: false });
console.log(JSON.stringify({ status, errors, failed: failed.filter((u) => !u.includes('favicon')).slice(0, 6) }, null, 2));
await browser.close();
