#!/usr/bin/env node
// capture-design-canvas.mjs
//
// Screenshot capture for design files. Three modes, auto-detected:
//
//   dc      DC canvas HTML with [data-dc-slot] artboards (original behavior)
//   simple  Plain HTML/CSS — full-page screenshot
//   svg     SVG file → PNG (viewport sized to SVG natural dimensions)
//
// Usage — DC canvas
//   node capture-design-canvas.mjs \
//     --html  canvas.html \
//     --out   specs/assets/versions/v1.5 \
//     --prefix v1.5 \
//     --map   v1.5-canvas-map.json \
//     --unclip score-matrix,feed-cards
//
// Usage — Simple HTML / SVG
//   node capture-design-canvas.mjs \
//     --html  local/raw/images/UI\ Design/screens/desktop/admin-dashboard.html \
//     --out   local/captures/desktop \
//     --prefix v1.0-web \
//     --viewport 1440x1024
//
//   node capture-design-canvas.mjs \
//     --html  local/raw/images/UI\ Design/design-system/logos/logo-primary.svg \
//     --out   local/captures/logos \
//     --prefix v1.1-design-system
//
// Usage — Batch (all files in a directory)
//   node capture-design-canvas.mjs \
//     --dir   local/raw/images/UI\ Design/screens/desktop \
//     --out   local/captures/desktop \
//     --prefix v1.0-web \
//     --viewport 1440x1024
//
//   node capture-design-canvas.mjs \
//     --dir   local/raw/images/UI\ Design/design-system/logos \
//     --ext   svg \
//     --out   local/captures/logos \
//     --prefix v1.1-design-system
//
// Options
//   --html <path>              Path to HTML or SVG file (required unless --dir)
//   --dir  <path>              Batch: capture all matching files in a directory
//   --ext  <ext>               With --dir: file extension to match (default: html)
//   --out  <dir>               Output directory for PNGs (required)
//   --prefix <slug>            Filename prefix (e.g. `v1.0-web`)
//   --mode <auto|dc|simple|svg>  Override auto-detection
//   --viewport <WxH>           Viewport for simple/svg modes (default: 1440x1024)
//   --scale <N>                deviceScaleFactor (default: 2)
//   --ids <id,id,...>          DC mode only: capture specific artboard ids
//   --unclip <id,id,...>       DC mode only: unclip overflow boards
//   --map <path.json>          DC mode only: artboard id → custom filename map
//   --headed                   Run Chrome in headed mode (debugging)
//
// Setup (once)
//   cd specs/scripts/tools && npm install

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { ids: [], unclip: [], headed: false, ext: 'html', viewport: '1440x1024', scale: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if      (a === '--html')     out.html     = next();
    else if (a === '--dir')      out.dir      = next();
    else if (a === '--ext')      out.ext      = next().replace(/^\./, '');
    else if (a === '--out')      out.out      = next();
    else if (a === '--prefix')   out.prefix   = next();
    else if (a === '--mode')     out.mode     = next();
    else if (a === '--viewport') out.viewport = next();
    else if (a === '--scale')    out.scale    = Number(next());
    else if (a === '--ids')      out.ids      = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--unclip')   out.unclip   = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--map')      out.mapPath  = next();
    else if (a === '--headed')   out.headed   = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || (!args.html && !args.dir) || !args.out) {
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(src.split('\n').slice(1, 56).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(args.help ? 0 : 1);
}

// ─── collect target files ───────────────────────────────────────────────────
function collectFiles(args) {
  if (args.html) return [path.resolve(args.html)];
  const dir = path.resolve(args.dir);
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.' + args.ext) && !f.startsWith('.'))
    .sort()
    .map(f => path.join(dir, f));
}

// ─── mode detection ─────────────────────────────────────────────────────────
function detectMode(filePath, modeOverride) {
  if (modeOverride && modeOverride !== 'auto') return modeOverride;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.svg') return 'svg';
  if (ext !== '.html') return 'simple';
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('data-dc-slot') ? 'dc' : 'simple';
}

// ─── puppeteer resolution ───────────────────────────────────────────────────
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  const fallbacks = [
    path.join(__dirname, 'node_modules', 'puppeteer'),
    ...fs.existsSync(path.join(process.env.HOME || '', '.npm/_npx'))
      ? fs.readdirSync(path.join(process.env.HOME, '.npm/_npx')).map(d =>
          path.join(process.env.HOME, '.npm/_npx', d, 'node_modules', 'puppeteer'))
      : [],
  ];
  for (const f of fallbacks) {
    if (fs.existsSync(path.join(f, 'package.json'))) {
      puppeteer = (await import(pathToFileURL(path.join(f, 'lib/esm/puppeteer.js')).href).catch(() => null))
               ?? require(f);
      if (puppeteer) break;
    }
  }
  if (!puppeteer) {
    console.error('puppeteer not found. Run: cd specs/scripts/tools && npm install');
    process.exit(1);
  }
}
if (puppeteer && puppeteer.default) puppeteer = puppeteer.default;

// ─── static server ──────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.jsx': 'text/jsx',
  '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function startServer(rootDir, entryFile) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/' + entryFile;
      const filePath = path.join(rootDir, urlPath);
      if (!filePath.startsWith(rootDir)) { res.writeHead(403).end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404).end(err.message); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ server: srv, port: srv.address().port }));
  });
}

// ─── filename helpers ────────────────────────────────────────────────────────
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function fileNameFor(id, prefix, nameMap) {
  if (nameMap && nameMap[id]) return nameMap[id] + '.png';
  const slug = slugify(id);
  return prefix ? `${prefix}-${slug}.png` : `${slug}.png`;
}

function fileNameForFile(filePath, prefix) {
  const base = path.basename(filePath, path.extname(filePath));
  const slug = slugify(base);
  return prefix ? `${prefix}-${slug}.png` : `${slug}.png`;
}

// ─── SVG natural size ───────────────────────────────────────────────────────
function svgNaturalSize(svgPath) {
  const src = fs.readFileSync(svgPath, 'utf8');
  const vb = src.match(/viewBox="([^"]+)"/);
  if (vb) {
    const [, , w, h] = vb[1].split(/\s+/).map(Number);
    if (w > 0 && h > 0) return { w: Math.ceil(w), h: Math.ceil(h) };
  }
  const wm = src.match(/\swidth="([0-9.]+)"/);
  const hm = src.match(/\sheight="([0-9.]+)"/);
  if (wm && hm) return { w: Math.ceil(Number(wm[1])), h: Math.ceil(Number(hm[1])) };
  return { w: 800, h: 600 };
}

// ─── capture: simple HTML ───────────────────────────────────────────────────
async function captureSimple(page, filePath, outDir, prefix, args) {
  const [vpW, vpH] = args.viewport.split('x').map(Number);
  await page.setViewport({ width: vpW, height: vpH, deviceScaleFactor: args.scale });

  const dir = path.dirname(filePath);
  const file = path.basename(filePath);
  const { server, port } = await startServer(dir, file);
  const url = `http://127.0.0.1:${port}/`;

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
    await new Promise(r => setTimeout(r, 800));

    const fileName = fileNameForFile(filePath, prefix);
    const outPath  = path.join(outDir, fileName);
    await page.screenshot({ path: outPath, fullPage: true });
    const sz = fs.statSync(outPath).size;
    console.log('OK ', path.basename(filePath).padEnd(40), '->', fileName, `(${(sz / 1024).toFixed(0)} KB)`);
    return { ok: true, file: fileName };
  } finally {
    server.close();
  }
}

// ─── capture: SVG ───────────────────────────────────────────────────────────
async function captureSvg(page, filePath, outDir, prefix, args) {
  const natural = svgNaturalSize(filePath);
  // Scale up small SVGs so the PNG is readable; cap at 4096px wide
  const scale = args.scale;
  const vpW   = Math.min(Math.max(natural.w * scale, 64), 4096);
  const vpH   = Math.min(Math.max(natural.h * scale, 64), 4096);

  await page.setViewport({ width: Math.ceil(vpW), height: Math.ceil(vpH), deviceScaleFactor: 1 });

  // Wrap SVG in HTML — loading a raw .svg URL gives an SVG document with no
  // document.head, which breaks addStyleTag. setContent gives us a real HTML doc.
  const svgContent = fs.readFileSync(filePath, 'utf8');
  const html = `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${Math.ceil(vpW)}px; height: ${Math.ceil(vpH)}px; overflow: hidden; background: transparent; }
    svg { width: 100%; height: 100%; display: block; }
  </style></head><body>${svgContent}</body></html>`;

  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
  await new Promise(r => setTimeout(r, 300));

  const fileName = fileNameForFile(filePath, prefix);
  const outPath  = path.join(outDir, fileName);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: Math.ceil(vpW), height: Math.ceil(vpH) } });
  const sz = fs.statSync(outPath).size;
  console.log('OK ', path.basename(filePath).padEnd(40), '->', fileName, `(${(sz / 1024).toFixed(0)} KB)`);
  return { ok: true, file: fileName };
}

// ─── capture: DC canvas ─────────────────────────────────────────────────────
async function captureDc(page, filePath, outDir, prefix, args, nameMap) {
  const dir  = path.dirname(filePath);
  const file = path.basename(filePath);
  const { server, port } = await startServer(dir, file);
  const url = `http://127.0.0.1:${port}/`;

  const ID_FILTER = new Set(args.ids);
  const UNCLIP    = new Set(args.unclip);

  try {
    await page.setViewport({ width: 1800, height: 2400, deviceScaleFactor: args.scale });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
    await page.waitForSelector('[data-dc-slot]', { timeout: 60_000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.addStyleTag({ content: `.dc-card { box-shadow: none !important; }` });

    const allIds    = await page.$$eval('[data-dc-slot]', els => els.map(el => el.dataset.dcSlot));
    const targetIds = ID_FILTER.size ? allIds.filter(id => ID_FILTER.has(id)) : allIds;
    console.log(`discovered ${allIds.length} artboards · capturing ${targetIds.length}`);

    const results = [];
    for (const id of targetIds) {
      if (UNCLIP.has(id)) {
        await page.evaluate(slotId => {
          const card = document.querySelector(`[data-dc-slot="${slotId}"] .dc-card`);
          if (card) { card.style.height = 'auto'; card.style.overflow = 'visible'; }
        }, id);
        await new Promise(r => setTimeout(r, 200));
      }
      const handle = await page.$(`[data-dc-slot="${id}"] .dc-card`);
      if (!handle) { console.log('MISS', id); results.push({ id, ok: false }); continue; }
      await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      await new Promise(r => setTimeout(r, 200));
      const fileName = fileNameFor(id, prefix, nameMap);
      const outPath  = path.join(outDir, fileName);
      await handle.screenshot({ path: outPath });
      const sz = fs.statSync(outPath).size;
      console.log('OK ', id.padEnd(20), '->', fileName, `(${(sz / 1024).toFixed(0)} KB)`);
      results.push({ id, ok: true, file: fileName, sz });
    }
    return results;
  } finally {
    server.close();
  }
}

// ─── main ───────────────────────────────────────────────────────────────────
const OUT_DIR  = path.resolve(args.out);
const PREFIX   = args.prefix || '';
const NAME_MAP = args.mapPath ? JSON.parse(fs.readFileSync(path.resolve(args.mapPath), 'utf8')) : {};
const targets  = collectFiles(args);

if (targets.length === 0) {
  console.error(`No files found (dir: ${args.dir}, ext: ${args.ext})`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: args.headed ? false : 'new',
  defaultViewport: null,
});

let okCount = 0;
let totalCount = 0;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) { console.log('SKIP', filePath, '(not found)'); continue; }

  const mode = detectMode(filePath, args.mode);
  if (targets.length > 1) console.log(`\n[${mode}] ${path.basename(filePath)}`);

  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });

  try {
    if (mode === 'simple') {
      const r = await captureSimple(page, filePath, OUT_DIR, PREFIX, args);
      if (r.ok) okCount++;
      totalCount++;
    } else if (mode === 'svg') {
      const r = await captureSvg(page, filePath, OUT_DIR, PREFIX, args);
      if (r.ok) okCount++;
      totalCount++;
    } else {
      // dc mode
      const results = await captureDc(page, filePath, OUT_DIR, PREFIX, args, NAME_MAP);
      const artOk = results.filter(r => r.ok).length;
      okCount    += artOk;
      totalCount += results.length;
    }
  } catch (err) {
    console.error('ERROR', path.basename(filePath), err.message);
    totalCount++;
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\n${okCount}/${totalCount} captured · out: ${OUT_DIR}`);
if (okCount < totalCount) process.exit(1);
