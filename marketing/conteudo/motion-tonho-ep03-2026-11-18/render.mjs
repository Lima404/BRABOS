// Render com Playwright (WebGL na placa de vídeo).
//   node render.mjs batidas [amostras]        um quadro por batida (0, 0.5, ... ) + o último → _batidas/
//   node render.mjs quadros 6.1 8.25 ...      quadros soltos (segundos) → _soltos/
//   node render.mjs video [amostras]          60 qps, cada quadro já com desfoque de movimento e foco → _sub/
//   node render.mjs trilha                    trilha em Web Audio (OfflineAudioContext) → trilha.wav
// Carga: no máximo 3 abas renderizando ao mesmo tempo.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CHROME = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const FPS = 60, ABAS = 3;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.wav': 'audio/wav', '.mjs': 'text/javascript' };

function servidor() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      const p = path.join(AQUI, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(AQUI) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

async function abrir(browser, porta, amostras) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('erro na página:', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.pronto, null, { timeout: 120000 });
  await page.evaluate(async a => { await window.pronto; window.AMOSTRAS = a; }, amostras);
  return page;
}

async function foto(page, t, arq, q = 92) {
  await page.evaluate(tt => new Promise(ok => { window.seek(tt); requestAnimationFrame(() => requestAnimationFrame(ok)); }), t);
  await page.screenshot({ path: arq, type: 'jpeg', quality: q });
}

async function main() {
  const modo = process.argv[2] || 'batidas';
  const srv = await servidor();
  const porta = srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-color-profile=srgb', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  try {
    if (modo === 'batidas' || modo === 'quadros') {
      const pasta = path.join(AQUI, modo === 'batidas' ? '_batidas' : '_soltos');
      fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
      const amostras = modo === 'batidas' ? Number(process.argv[3] || 4) : Number(process.env.AMOSTRAS || 8);
      const p0 = await abrir(browser, porta, amostras);
      const DUR = await p0.evaluate(() => window.DUR);
      const tempos = modo === 'batidas' ? [...Array.from({ length: Math.round(DUR * 2) }, (_, i) => i * 0.5), DUR - 1 / FPS] : process.argv.slice(3).map(Number);
      const pages = [p0, ...(await Promise.all(Array.from({ length: Math.min(ABAS, tempos.length) - 1 }, () => abrir(browser, porta, amostras))))];
      let i = 0; const t0 = Date.now();
      await Promise.all(pages.map(async pg => { while (i < tempos.length) { const k = i++; await foto(pg, tempos[k], path.join(pasta, `q_${String(k).padStart(3, '0')}_${tempos[k].toFixed(2)}.jpg`), 88); } }));
      console.log(`${tempos.length} quadros em ${((Date.now() - t0) / 1000).toFixed(1)} s → ${pasta}`);
    } else if (modo === 'video') {
      const pasta = path.join(AQUI, '_sub');
      fs.mkdirSync(pasta, { recursive: true });
      const amostras = Number(process.argv[3] || 10);
      const pages = await Promise.all(Array.from({ length: ABAS }, () => abrir(browser, porta, amostras)));
      const DUR = await pages[0].evaluate(() => window.DUR);
      const total = Math.round(DUR * FPS);
      let n = 0; const t0 = Date.now();
      await Promise.all(pages.map(async pg => {
        while (n < total) {
          const k = n++;
          const arq = path.join(pasta, `f_${String(k).padStart(5, '0')}.jpg`);
          if (fs.existsSync(arq)) continue;
          await foto(pg, k / FPS, arq, 95);
          if (k % 300 === 0) console.log(`  ${k}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
        }
      }));
      console.log(`quadros prontos em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    } else if (modo === 'trilha') {
      const page = await abrir(browser, porta, 1);
      await page.addScriptTag({ path: path.join(AQUI, 'trilha.js') });
      const b64 = await page.evaluate(() => window.gerarTrilha());
      fs.writeFileSync(path.join(AQUI, 'trilha.wav'), Buffer.from(b64, 'base64'));
      console.log('trilha.wav pronta');
    }
  } finally {
    await browser.close(); srv.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
