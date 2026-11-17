// Capturas locales del portal DietForge (antes/después). Uso:
//   node portal-captura.mjs antes|despues
// Requiere `npm run dev` en http://localhost:3000 y Brave instalado.
import puppeteer from 'puppeteer-core';
import {mkdirSync} from 'node:fs';

const fase = process.argv[2] === 'antes' ? 'antes' : 'despues';
const base = process.env.PORTAL_BASE || 'http://localhost:3000';
mkdirSync('capturas', {recursive: true});

const shots = [
  {name: 'auth', url: '/portal', viewport: {width: 1440, height: 1000}, wait: '#portal-auth-title'},
  {name: 'auth-movil', url: '/portal', viewport: {width: 390, height: 844}, wait: '#portal-auth-title'},
  {name: 'dieta', url: '/dev/portal', viewport: {width: 1440, height: 1100}, wait: '.portal-plan', click: 'Dieta'},
  {name: 'rutina', url: '/dev/portal', viewport: {width: 1440, height: 1100}, wait: '.portal-mesocycle', click: 'Rutina'},
  {name: 'progreso', url: '/dev/portal', viewport: {width: 1440, height: 1100}, wait: '.portal-checkin', click: 'Progreso'},
  {name: 'agenda', url: '/dev/portal', viewport: {width: 1440, height: 1100}, wait: '.care-calendar', click: 'Agenda'},
  {name: 'dieta-movil', url: '/dev/portal', viewport: {width: 390, height: 844}, wait: '.portal-plan', click: 'Dieta'},
];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: 'new',
  args: ['--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1'],
});

const page = await browser.newPage();
page.on('pageerror', error => console.log('PAGEERROR:', error.message));
page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE:', message.text()); });

for (const shot of shots) {
  await page.setViewport({...shot.viewport, deviceScaleFactor: 1});
  await page.goto(base + shot.url, {waitUntil: 'networkidle2', timeout: 90000});
  if (shot.click) {
    const clicked = await page.evaluate((label) => {
      const button = Array.from(document.querySelectorAll('.care-tabs button')).find(node => (node.textContent || '').includes(label));
      if (!button) return false;
      button.click();
      return true;
    }, shot.click);
    if (!clicked) console.log('Sin pestaña:', shot.click);
  }
  await page.waitForSelector(shot.wait, {timeout: 30000}).catch(() => console.log('Sin selector:', shot.wait, shot.name));
  await new Promise(resolve => setTimeout(resolve, 900));
  const file = `capturas/portal-${fase}-${shot.name}.png`;
  await page.screenshot({path: file, fullPage: true});
  console.log('Guardada', file);
}

await browser.close();
