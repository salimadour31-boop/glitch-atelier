// Headless UI test (Playwright + Chrome/Chromium): node tests/ui.test.js
// Serves the folder locally and drives the interface at 1440 × 900 (desktop) and 390 × 844 (mobile, touch):
// no console errors, no horizontal overflow, Web Worker in use, every effect renders and changes pixels (incl. real
// JPEG-byte corruption), every select option renders, presets load, FR → EN → Taqbaylit → Tifinagh and persistence,
// layer toggle / reorder (buttons + Alt+arrows) / duplicate / delete, undo / redo, seed + keyboard shortcuts, compare,
// zoom 100 %, image loading (file picker + drag & drop), PNG / JPG export at full resolution, JSON export → import
// round trip, URL hash restore, WebM loop recording. Writes the README screenshots.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.resolve(__dirname, '../../node_modules/playwright'))); }
const Presets = require('../js/presets.js'), G = require('../js/effects.js');
const root = path.resolve(__dirname, '..'), shots = path.join(root, 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
let checks = 0;
const ok = (cond, msg) => { assert(cond, msg); checks++; };
async function download(page, action) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), action()]);
  return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) };
}
const idle = (page) => page.evaluate(() => GlitchApp.idle());
const diffOrig = (page) => page.evaluate(() => {
  const a = document.getElementById('out'), b = document.getElementById('orig');
  const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
  let s = 0, n = 0;
  for (let i = 0; i < da.length; i += 16) { s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); n++; }
  return s / n / 3;
});
const outHash = (page) => page.evaluate(() => {
  const a = document.getElementById('out'), d = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
  let h = 2166136261; for (let i = 0; i < d.length; i += 7) { h ^= d[i]; h = Math.imul(h, 16777619); } return (h >>> 0) + ':' + a.width + 'x' + a.height;
});
const stackSig = (page) => page.evaluate(() => JSON.stringify(Glitch.serialize(GlitchApp.state)));
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

async function run(browser, base, vp, name) {
  const mobile = vp.width < 500;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  const page = await ctx.newPage(), errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + 'index.html');
  await page.waitForFunction(() => window.GlitchApp && GlitchApp.renderCount > 0);
  await idle(page);
  console.log(`\n[${name}] ${vp.width}×${vp.height}`);

  ok(await page.evaluate(() => GlitchApp.usingWorker), 'Web Worker not used');
  ok(await page.evaluate(() => document.documentElement.lang) === 'fr', 'default language is not French');
  ok(await page.textContent('#hPresets') === 'Préréglages', 'French label');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow');
  ok(await diffOrig(page) > 3, 'default preset does not change the demo image');
  ok((await page.textContent('#info')).includes('1600×1000'), 'info line');
  console.log('  ✓ boot: worker, French default, no overflow, demo image glitched');

  // every effect through the UI: clear, add, render, compare with the original
  for (const type of G.TYPES) {
    await page.click('#clearBtn'); await idle(page);
    ok(await diffOrig(page) < 0.01, 'empty stack should show the original');
    await page.selectOption('#addType', type); await page.click('#addBtn'); await idle(page);
    const d = await diffOrig(page);
    ok(d > 0.5, `${type} did not change pixels (${d})`);
    ok(await page.locator('.layer').count() === 1, 'layer card');
  }
  console.log(`  ✓ ${G.TYPES.length} effects render and change pixels`);
  if (!mobile) {
    // every select option of every effect via the generated controls
    for (const type of G.TYPES) {
      await page.click('#clearBtn'); await page.selectOption('#addType', type); await page.click('#addBtn'); await idle(page);
      const selects = page.locator('.layer-body label:not([hidden]) select');
      const count = await selects.count();
      for (let s = 0; s < count; s++) {
        const opts = await selects.nth(s).locator('option').evaluateAll((os) => os.map((o) => o.value));
        for (const o of opts) { await selects.nth(s).selectOption(o); await idle(page); ok(await diffOrig(page) >= 0, 'render'); }
      }
    }
    // real JPEG byte corruption
    await page.click('#clearBtn'); await page.selectOption('#addType', 'jpeg'); await page.click('#addBtn');
    await page.locator('.layer-body select').nth(1).selectOption('bytes'); await idle(page);
    ok(await diffOrig(page) > 0.5, 'jpeg bytes mode');
    console.log('  ✓ every select option renders; real JPEG-byte corruption works');
    // a range slider drives the render
    const h1 = await outHash(page);
    const slider = page.locator('.layer-body input[type=range]').nth(2);
    await slider.evaluate((e) => { e.value = 0.9; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await idle(page);
    ok(await outHash(page) !== h1, 'slider does not re-render');
    console.log('  ✓ sliders re-render');
  }

  // presets
  for (const p of Presets.LIST) {
    await page.click(`.preset[data-preset="${p.id}"]`); await idle(page);
    ok(await page.locator('.layer').count() === p.stack.length, 'preset stack length ' + p.id);
    ok(await diffOrig(page) > 1, 'preset has no visible effect: ' + p.id);
    ok(await page.getAttribute(`.preset[data-preset="${p.id}"]`, 'aria-pressed') === 'true', 'preset marked');
  }
  console.log(`  ✓ ${Presets.LIST.length} presets load and render`);

  // layers: toggle, reorder, keyboard reorder, duplicate, delete
  await page.click('.preset[data-preset="cyber"]'); await idle(page);
  const order = () => page.evaluate(() => GlitchApp.state.stack.map((L) => L.type).join(','));
  ok(await order() === 'rgb,slices,posterize,crt', 'cyber order');
  await page.locator('.layer').nth(0).locator('button.down').click(); await idle(page);
  ok(await order() === 'slices,rgb,posterize,crt', 'move down');
  await page.locator('.layer').nth(1).locator('.grip').focus(); await page.keyboard.press('Alt+ArrowUp'); await idle(page);
  ok(await order() === 'rgb,slices,posterize,crt', 'Alt+Up');
  const before = await outHash(page);
  await page.locator('.layer').nth(3).locator('.layer-on').uncheck(); await idle(page);
  ok(await outHash(page) !== before && (await page.evaluate(() => GlitchApp.state.stack[3].on)) === false, 'toggle off');
  await page.locator('.layer').nth(0).locator('button.dup').click();
  ok(await order() === 'rgb,rgb,slices,posterize,crt', 'duplicate');
  await page.locator('.layer').nth(1).locator('button.del').click(); await idle(page);
  ok(await order() === 'rgb,slices,posterize,crt', 'delete');
  console.log('  ✓ layer toggle / reorder (buttons + Alt+↑) / duplicate / delete');

  // undo / redo (buttons + keyboard)
  await page.click('#undoBtn'); await idle(page);
  ok(await order() === 'rgb,rgb,slices,posterize,crt', 'undo');
  await page.click('#redoBtn'); await idle(page);
  ok(await order() === 'rgb,slices,posterize,crt', 'redo');
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Control+z'); await idle(page);
  ok(await order() === 'rgb,rgb,slices,posterize,crt', 'Ctrl+Z');
  await page.keyboard.press('Control+y'); await idle(page);
  ok(await order() === 'rgb,slices,posterize,crt', 'Ctrl+Y');
  console.log('  ✓ undo / redo (buttons, Ctrl+Z, Ctrl+Y)');

  // seed: same seed → same image, re-roll → different image
  await page.click('.preset[data-preset="datamosh"]'); await idle(page);
  const hA = await outHash(page), seedA = await page.inputValue('#seed');
  await page.click('#rerollBtn'); await idle(page);
  ok(await page.inputValue('#seed') !== seedA && await outHash(page) !== hA, 're-roll');
  await page.fill('#seed', seedA); await page.press('#seed', 'Enter'); await page.locator('#seed').blur(); await idle(page);
  ok(await outHash(page) === hA, 'same seed should reproduce the image');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('r'); await idle(page);
  ok(await page.inputValue('#seed') !== seedA, 'R shortcut');
  console.log('  ✓ seed reproducible, re-roll button + R shortcut');

  // compare + peek + help
  await page.keyboard.press('c');
  ok(await page.evaluate(() => document.getElementById('stage').classList.contains('cmp')) && await page.isVisible('#cmpRow'), 'compare on');
  await page.locator('#cmp').evaluate((e) => { e.value = 30; e.dispatchEvent(new Event('input', { bubbles: true })); });
  ok((await page.evaluate(() => document.getElementById('orig').style.clipPath)).includes('70%'), 'compare clip');
  await page.click('#cmpBtn');
  ok(!(await page.evaluate(() => document.getElementById('stage').classList.contains('cmp'))), 'compare off');
  await page.keyboard.press('Shift+?');
  ok(await page.evaluate(() => document.getElementById('help').open), 'help dialog');
  await page.keyboard.press('Escape');
  ok(!(await page.evaluate(() => document.getElementById('help').open)), 'help closes');
  console.log('  ✓ compare slider, help dialog');

  // zoom 100 % renders the preview at full size
  await page.click('#zoomBtn'); await idle(page);
  ok(await page.evaluate(() => document.getElementById('out').width) === 1600, 'zoom 100 %');
  await page.click('#fitBtn'); await idle(page);
  ok(await page.evaluate(() => document.getElementById('out').width) === 1000, 'fit');
  console.log('  ✓ zoom 100 % / fit');

  // exports
  await page.click('.preset[data-preset="vhs"]'); await idle(page);
  const png = await download(page, () => page.click('#pngBtn'));
  ok(png.name.endsWith('.png') && png.buf.slice(1, 4).toString() === 'PNG', 'PNG file');
  const sz = pngSize(png.buf); ok(sz.w === 1600 && sz.h === 1000, 'PNG full resolution ' + JSON.stringify(sz));
  const jpg = await download(page, () => page.click('#jpgBtn'));
  ok(jpg.name.endsWith('.jpg') && jpg.buf[0] === 0xff && jpg.buf[1] === 0xd8, 'JPG file');
  console.log(`  ✓ PNG ${sz.w}×${sz.h} (${(png.buf.length / 1024) | 0} KB) and JPG exports`);

  // JSON export → change everything → import → same stack and same pixels
  await page.click('.preset[data-preset="lostSignal"]'); await idle(page);
  const sig = await stackSig(page), hJ = await outHash(page);
  const js = await download(page, () => page.click('#jsonBtn'));
  const parsed = JSON.parse(js.buf.toString()); ok(parsed.app === 'glitch-atelier' && parsed.stack.length === 4, 'JSON content');
  await page.click('#clearBtn'); await page.click('#rerollBtn'); await idle(page);
  const jf = path.join(require('os').tmpdir(), 'glitch-settings.json'); fs.writeFileSync(jf, js.buf);
  await page.setInputFiles('#jsonFile', jf); await page.waitForFunction(() => GlitchApp.state.stack.length === 4); await idle(page);
  ok(await stackSig(page) === sig && await outHash(page) === hJ, 'JSON round trip');
  await page.setInputFiles('#jsonFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
  await page.waitForFunction(() => document.getElementById('toast').textContent.length > 0);
  ok(await stackSig(page) === sig, 'invalid JSON must not change the stack');
  console.log('  ✓ JSON export → import round trip (identical pixels), invalid file rejected');

  // URL hash: share link restores the stack in a fresh page
  await page.click('#shareBtn');
  const url = await page.inputValue('#shareOut');
  ok(/#g=[A-Za-z0-9_-]+$/.test(url), 'share URL');
  const p2 = await ctx.newPage(), err2 = [];
  p2.on('pageerror', (e) => err2.push(String(e))); p2.on('console', (m) => { if (m.type() === 'error') err2.push(m.text()); });
  await p2.goto(url); await p2.waitForFunction(() => window.GlitchApp && GlitchApp.renderCount > 0); await idle(p2);
  ok(await stackSig(p2) === sig && await outHash(p2) === hJ, 'URL hash restore');
  ok(!err2.length, 'errors on page 2: ' + err2.join(' | '));
  await p2.close();
  console.log('  ✓ URL hash restores the stack (identical pixels)');

  // image loading: file picker + drag & drop
  const imgPath = path.join(require('os').tmpdir(), 'glitch-test.png');
  fs.writeFileSync(imgPath, await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 200 } }));
  await page.setInputFiles('#file', imgPath);
  await page.waitForFunction(() => /^(320|640)×(200|400)/.test(document.getElementById('info').textContent)); await idle(page);
  ok(await diffOrig(page) > 0.5, 'loaded image glitched');
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 150; const x = c.getContext('2d');
    x.fillStyle = '#f08'; x.fillRect(0, 0, 300, 150); x.fillStyle = '#0ef'; x.fillRect(50, 30, 120, 80);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'drop.png', { type: 'image/png' }));
    document.getElementById('stage').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => document.getElementById('info').textContent.startsWith('300×150')); await idle(page);
  console.log('  ✓ image loading via file picker and drag & drop');
  await page.click('#demoBtn'); await idle(page);

  // languages
  await page.selectOption('#lang', 'en');
  ok(await page.textContent('#hPresets') === 'Presets' && await page.evaluate(() => document.documentElement.lang) === 'en', 'English');
  ok((await page.textContent('.layer .name')).length > 0, 'layer names translated');
  await page.selectOption('#lang', 'kab');
  ok(await page.textContent('#hPresets') === 'Iɣewwaren uzwiren' && await page.isVisible('#tfngWrap'), 'Taqbaylit');
  await page.check('#tfng');
  ok(/[\u2D30-\u2D7F]/.test(await page.textContent('#hPresets')) && await page.evaluate(() => document.documentElement.lang) === 'kab-Tfng', 'Tifinagh');
  await page.reload(); await page.waitForFunction(() => window.GlitchApp && GlitchApp.renderCount > 0);
  ok(await page.evaluate(() => document.documentElement.lang) === 'kab-Tfng', 'language persisted in localStorage');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'overflow in Tifinagh');
  await page.uncheck('#tfng'); await page.selectOption('#lang', 'fr');
  ok(await page.textContent('#hPresets') === 'Préréglages', 'back to French');
  console.log('  ✓ FR → EN → Taqbaylit → Tifinagh, persisted after reload');

  // WebM loop
  if (!mobile) {
    ok(!!(await page.evaluate(() => GlitchApp.webmMime())), 'MediaRecorder WebM support in this Chrome');
    await page.selectOption('#vDur', '1'); await page.selectOption('#vFps', '12'); await page.selectOption('#vSize', '480');
    const t0 = Date.now();
    const webm = await download(page, () => page.click('#webmBtn'));
    ok(webm.name.endsWith('.webm') && webm.buf.readUInt32BE(0) === 0x1a45dfa3 && webm.buf.length > 2000, 'WebM file');
    console.log(`  ✓ WebM loop ${(webm.buf.length / 1024) | 0} KB in ${Date.now() - t0} ms`);
  }

  // screenshots
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(base + 'index.html'); await page.waitForFunction(() => window.GlitchApp && GlitchApp.renderCount > 0);
  await page.click('.preset[data-preset="datamosh"]'); await idle(page);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(3000); // let the toast fade
  if (mobile) {
    await page.screenshot({ path: path.join(shots, 'mobile.png') });
    await page.locator('#hStack').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, 'mobile-stack.png') });
  } else {
    await page.screenshot({ path: path.join(shots, 'desktop.png') });
    await page.click('.preset[data-preset="sortSoft"]'); await idle(page);
    await page.click('#cmpBtn'); await page.locator('#cmp').evaluate((e) => { e.value = 45; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(shots, 'desktop-compare.png') });
  }
  ok(!errors.length, 'console errors: ' + errors.join(' | '));
  console.log('  ✓ no console errors; screenshots written');
  await ctx.close();
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}) });
  try {
    await run(browser, base, { width: 1440, height: 900 }, 'desktop');
    await run(browser, base, { width: 390, height: 844 }, 'mobile');
    // opened straight from disk (file://): no Worker allowed → main-thread fallback, still no errors
    const pf = await browser.newPage(), errF = [];
    pf.on('pageerror', (e) => errF.push(String(e))); pf.on('console', (m) => { if (m.type() === 'error') errF.push(m.text()); });
    await pf.goto('file://' + path.join(root, 'index.html')); await pf.waitForFunction(() => window.GlitchApp && GlitchApp.renderCount > 0);
    ok(!(await pf.evaluate(() => GlitchApp.usingWorker)) && !errF.length, 'file:// fallback ' + errF.join(' | '));
    await pf.close();
    console.log('\n[file://] ✓ main-thread fallback renders without errors');
    console.log(`\nUI tests passed (${checks} checks)`);
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
