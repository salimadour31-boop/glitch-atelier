/* app.js — Glitch Atelier user interface: image loading, live preview (Web Worker), effect stack editor,
 * presets, seed, history, compare slider, zoom, exports (PNG / JPG / WebM / JSON / link) and languages. MIT licence. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('glitch-atelier.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('glitch-atelier.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  /* ------------------------------------------------------------------ state */
  const state = {
    lang: store.get('lang', 'fr'), tfng: !!store.get('tfng', false),
    seed: 1, stack: [], open: new Set(), presetId: null,
    zoom: 'fit', compare: false, cmp: 50, previewMax: 1000, playing: false,
  };
  if (!I18N.LANGS.includes(state.lang)) state.lang = 'fr';
  const t = (k, v) => I18N.t(k, state.lang, v, state.tfng);
  const locale = () => (state.lang === 'en' ? 'en' : 'fr');

  // Only show the parameters that matter for the current mode of an effect.
  const SHOW = {
    sort: { angle: (p) => p.dir === 'angle' },
    jpeg: { drift: (p) => p.mode === 'dct', block: (p) => p.mode === 'dct', subsample: (p) => p.mode === 'dct' },
    mirror: { segments: (p) => p.mode === 'kaleido', rotate: (p) => p.mode === 'kaleido', tiles: (p) => p.mode === 'tile',
      cx: (p) => !['tb', 'bt', 'tile'].includes(p.mode), cy: (p) => !['lr', 'rl', 'tile'].includes(p.mode) },
  };
  const visible = (L, key) => !(SHOW[L.type] && SHOW[L.type][key]) || SHOW[L.type][key](L.params);

  /* ------------------------------------------------------------------ small DOM helpers */
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids) if (c != null) e.append(c);
    return e;
  }
  let toastTimer = 0;
  function toast(msg) {
    const tt = $('toast');
    tt.textContent = msg; tt.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => tt.classList.remove('show'), 2600);
  }
  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(t('saved', { name }));
  }
  const busyEl = $('busy'), busyText = $('busyText');
  const busy = (msg) => { if (msg == null) { busyEl.hidden = true; return; } busyEl.hidden = false; busyText.textContent = msg; };

  /* ------------------------------------------------------------------ renderer (Web Worker with main-thread fallback) */
  function makeRenderer() {
    let worker = null, nextId = 1;
    const jobs = new Map();
    const local = (j) => Glitch.render(j.img, j.stack, Object.assign({}, j.opts, { onStep: (i, n) => j.onProgress && j.onProgress(i / n) }));
    function fallback() {
      if (!worker) return;
      try { worker.terminate(); } catch (e) { /* ignore */ }
      worker = null;
      for (const [id, j] of jobs) { jobs.delete(id); local(j).then(j.resolve, j.reject); }
    }
    try {
      worker = new Worker('js/worker.js');
      worker.onmessage = (e) => {
        const m = e.data, j = jobs.get(m.id);
        if (!j) return;
        if (m.progress != null) { if (j.onProgress) j.onProgress(m.progress); return; }
        jobs.delete(m.id);
        if (m.ok) j.resolve({ width: m.width, height: m.height, data: new Uint8ClampedArray(m.buffer) });
        else j.reject(new Error(m.error));
      };
      worker.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); fallback(); };
    } catch (e) { worker = null; } // e.g. opened from file:// — everything still works on the main thread
    function run(img, stack, opts, onProgress) {
      const j = { img, stack: JSON.parse(JSON.stringify(stack)), opts, onProgress };
      return new Promise((resolve, reject) => {
        j.resolve = resolve; j.reject = reject;
        if (!worker) { setTimeout(() => local(j).then(resolve, reject), 0); return; }
        const id = nextId++, copy = new Uint8ClampedArray(img.data);
        jobs.set(id, j);
        worker.postMessage({ id, width: img.width, height: img.height, buffer: copy.buffer, stack: j.stack, opts }, [copy.buffer]);
      });
    }
    return { run, get worker() { return !!worker; } };
  }
  const previewR = makeRenderer(), exportR = makeRenderer();

  /* ------------------------------------------------------------------ image sources */
  const MAX_SIDE = 6000, MAX_PIXELS = 24e6;
  const outCv = $('out'), outCtx = outCv.getContext('2d'), origCv = $('orig'), origCtx = origCv.getContext('2d');
  let full = null, fullCv = null, preview = null, previewK = 1;

  /** Use any drawable (bitmap, image, canvas) as the new source, capped to MAX_SIDE / MAX_PIXELS. */
  function setSource(drawable, w, h) {
    const s = Math.min(1, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
    const W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
    fullCv = el('canvas', { width: W, height: H });
    const cx = fullCv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(drawable, 0, 0, W, H);
    const id = cx.getImageData(0, 0, W, H);
    full = { width: W, height: H, data: id.data };
    buildPreview();
    if (s < 1) toast(t('tooBig', { w: W, h: H }));
    return { W, H };
  }
  /** Downscaled copy of the source used for the live preview (full size at 100 % zoom). */
  function buildPreview() {
    if (!full) return;
    const lim = state.zoom === '1' ? Math.max(full.width, full.height) : state.previewMax;
    const s = Math.min(1, lim / Math.max(full.width, full.height));
    const pw = Math.max(1, Math.round(full.width * s)), ph = Math.max(1, Math.round(full.height * s));
    if (s === 1) preview = full;
    else {
      const c = el('canvas', { width: pw, height: ph }), cx = c.getContext('2d', { willReadFrequently: true });
      cx.imageSmoothingQuality = 'high'; cx.drawImage(fullCv, 0, 0, pw, ph);
      preview = { width: pw, height: ph, data: cx.getImageData(0, 0, pw, ph).data };
    }
    previewK = pw / full.width;
    outCv.width = origCv.width = pw; outCv.height = origCv.height = ph;
    origCtx.putImageData(new ImageData(new Uint8ClampedArray(preview.data), pw, ph), 0, 0);
    outCtx.putImageData(new ImageData(new Uint8ClampedArray(preview.data), pw, ph), 0, 0);
    requestRender();
  }
  async function loadFile(file) {
    if (!file) return;
    try {
      let bmp;
      try { bmp = await createImageBitmap(file); } catch (e) {
        bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
      }
      const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
      if (!w || !h) throw new Error('empty');
      setSource(bmp, w, h);
      if (bmp.close) bmp.close();
      toast(t('loaded', { w: full.width, h: full.height }));
    } catch (e) { toast(t('loadError')); }
  }

  /** Original procedural demo image: synthwave sky, striped sun, ridges, neon grid floor, colour chips, title. */
  function demoCanvas() {
    const W = 1600, H = 1000, c = el('canvas', { width: W, height: H }), x = c.getContext('2d'), rnd = Glitch.rng32(2026), hz = H * 0.62;
    let g = x.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#0f0828'); g.addColorStop(0.45, '#4f1870'); g.addColorStop(0.8, '#e2457d'); g.addColorStop(1, '#ffb46a');
    x.fillStyle = g; x.fillRect(0, 0, W, hz);
    for (let i = 0; i < 170; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.7})`; const s = rnd() < 0.1 ? 3 : 1.6; x.fillRect(rnd() * W, rnd() * hz * 0.55, s, s); }
    // sun with cut stripes, drawn on its own canvas
    const sc = el('canvas', { width: 520, height: 520 }), sx = sc.getContext('2d');
    g = sx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, '#fff36b'); g.addColorStop(0.55, '#ff8a4a'); g.addColorStop(1, '#ff2e88');
    sx.fillStyle = g; sx.beginPath(); sx.arc(260, 260, 250, 0, Math.PI * 2); sx.fill();
    sx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) { const y = 270 + i * 26 + i * i * 1.5; sx.fillRect(0, y, 520, 3 + i * 1.6); }
    x.drawImage(sc, W / 2 - 260, hz - 420);
    // two ridges of mountains
    for (const [col, base, amp, rim] of [['#3a1258', hz - 40, 150, '#ff6fb0'], ['#1c0a33', hz, 110, '#19e3ff']]) {
      x.beginPath(); x.moveTo(0, hz + 2);
      for (let px = 0; px <= W; px += 40) x.lineTo(px, base - amp * (0.25 + rnd() * 0.75) * (0.6 + 0.4 * Math.abs(Math.sin(px / 210))));
      x.lineTo(W, hz + 2); x.closePath(); x.fillStyle = col; x.fill();
      x.strokeStyle = rim; x.globalAlpha = 0.55; x.lineWidth = 2; x.stroke(); x.globalAlpha = 1;
    }
    // neon grid floor
    g = x.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#1a0830'); g.addColorStop(1, '#05030c');
    x.fillStyle = g; x.fillRect(0, hz, W, H - hz);
    x.strokeStyle = '#19e3ff'; x.shadowColor = '#19e3ff'; x.shadowBlur = 10; x.lineWidth = 2;
    for (let i = 1; i < 14; i++) { const y = hz + Math.pow(i / 13, 2.2) * (H - hz); x.globalAlpha = 0.25 + 0.75 * i / 13; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    for (let i = -16; i <= 16; i++) { x.globalAlpha = 0.8; x.beginPath(); x.moveTo(W / 2 + i * 16, hz); x.lineTo(W / 2 + i * 190, H); x.stroke(); }
    x.globalAlpha = 1; x.shadowBlur = 0;
    // colour chips (gives the hue / saturation sorters something to chew on)
    const chips = ['#ff2e88', '#ff8a00', '#ffe600', '#5cff5c', '#19e3ff', '#3d5afe', '#b14dff', '#ffffff'];
    chips.forEach((cc, i) => { x.fillStyle = cc; x.fillRect(48 + i * 46, 48, 38, 38); });
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '600 20px ui-monospace, Menlo, Consolas, monospace'; x.fillText('SIGNAL // 2026', 48, 118);
    // title with channel ghosts
    x.textAlign = 'center'; x.font = '900 170px system-ui, "Segoe UI", Roboto, sans-serif';
    const ty = H * 0.86;
    x.fillStyle = '#19e3ff'; x.fillText('GLITCH', W / 2 - 7, ty);
    x.fillStyle = '#ff2e88'; x.fillText('GLITCH', W / 2 + 7, ty);
    x.fillStyle = '#f6f2ff'; x.fillText('GLITCH', W / 2, ty);
    x.font = '700 30px ui-monospace, Menlo, Consolas, monospace'; x.fillStyle = '#ffb46a'; x.fillText('A T E L I E R', W / 2, ty + 52);
    return c;
  }
  function loadDemo() { const c = demoCanvas(); setSource(c, c.width, c.height); }

  /* ------------------------------------------------------------------ live preview */
  let rendering = false, dirty = false, lastMs = 0, renderCount = 0, animT0 = 0, animTick = 0, idleWaiters = [];
  function requestRender() { dirty = true; if (!rendering) pump(); }
  async function pump() {
    if (!preview) return;
    rendering = true;
    while (dirty) {
      dirty = false;
      const t0 = performance.now(), src = preview;
      const dur = Number($('vDur').value) || 3;
      const time = state.playing ? ((performance.now() - animT0) / 1000 / dur) % 1 : 0, tick = state.playing && $('vVary').checked ? animTick : 0;
      try {
        const out = await previewR.run(src, state.stack, { seed: state.seed, k: previewK, time, tick });
        if (src === preview && out.width === outCv.width && out.height === outCv.height) outCtx.putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
        lastMs = Math.round(performance.now() - t0);
        renderCount++;
        updateInfo();
      } catch (e) { toast(String(e.message || e)); }
      if (state.playing && !dirty) { await new Promise((r) => requestAnimationFrame(r)); animTick++; dirty = state.playing; }
    }
    rendering = false;
    const w = idleWaiters; idleWaiters = []; w.forEach((f) => f());
  }
  function updateInfo() {
    if (!full) return;
    $('info').textContent = t('info', { w: full.width, h: full.height, pw: outCv.width, ph: outCv.height, ms: lastMs });
  }

  /* ------------------------------------------------------------------ history, URL hash */
  const hist = { past: [], future: [], cur: null };
  const snapshot = () => JSON.stringify({ seed: state.seed, stack: state.stack });
  let lastHash = '';
  function updateHash() {
    lastHash = '#' + Glitch.toHash(state);
    try { history.replaceState(null, '', lastHash); } catch (e) { /* sandboxed */ }
  }
  function commit() {
    const s = snapshot();
    if (s === hist.cur) return;
    if (hist.cur) hist.past.push(hist.cur);
    if (hist.past.length > 100) hist.past.shift();
    hist.cur = s; hist.future = [];
    updateHash(); updateHistButtons();
  }
  function updateHistButtons() { $('undoBtn').disabled = !hist.past.length; $('redoBtn').disabled = !hist.future.length; }
  function restore(s) { const o = JSON.parse(s); state.seed = o.seed; state.stack = o.stack; syncAll(); updateHash(); updateHistButtons(); }
  function undo() { if (!hist.past.length) return toast(t('nothingUndo')); hist.future.push(hist.cur); hist.cur = hist.past.pop(); restore(hist.cur); }
  function redo() { if (!hist.future.length) return toast(t('nothingRedo')); hist.past.push(hist.cur); hist.cur = hist.future.pop(); restore(hist.cur); }
  /** Replace seed + stack (from a preset, JSON, link…) and refresh everything. */
  function applyState(st, presetId) {
    state.seed = st.seed >>> 0; state.stack = st.stack; state.presetId = presetId || null;
    state.open = new Set(st.stack.length ? [st.stack[0].id] : []);
    syncAll(); commit();
  }
  function syncAll() { $('seed').value = state.seed; buildLayers(); markPreset(); requestRender(); }

  /* ------------------------------------------------------------------ presets, surprise, seed */
  function buildPresets() {
    const box = $('presets'); box.textContent = '';
    for (const p of Presets.LIST) box.append(el('button', { type: 'button', class: 'btn preset', 'data-preset': p.id, text: t('pr_' + p.id), onclick: () => loadPreset(p.id) }));
    markPreset();
  }
  function markPreset() { $$('.preset').forEach((b) => { const on = b.dataset.preset === state.presetId; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); }); }
  function loadPreset(id) { applyState(Presets.build(id, Glitch), id); toast(t('presetLoaded', { name: t('pr_' + id) })); }
  function surprise() {
    const r = Math.random, types = Glitch.TYPES.slice(), n = 2 + Math.floor(r() * 3), stack = [];
    for (let i = 0; i < n; i++) {
      const type = types.splice(Math.floor(r() * types.length), 1)[0], params = {};
      for (const s of Glitch.EFFECTS[type].params) {
        if (s.type === 'range') params[s.key] = Math.round((s.def + (r() - 0.5) * (s.max - s.min) * 0.3) / s.step) * s.step;
        else if (s.type === 'select') params[s.key] = s.options[Math.floor(r() * s.options.length)];
        else params[s.key] = r() < 0.5;
      }
      stack.push(Glitch.makeLayer(type, params, { mix: 0.6 + r() * 0.4 }));
    }
    applyState({ seed: Math.floor(r() * 1e6), stack });
  }
  function reroll() { state.seed = Math.floor(Math.random() * 1e6); $('seed').value = state.seed; requestRender(); commit(); }

  /* ------------------------------------------------------------------ effect stack editor */
  function buildAddSelect() {
    const sel = $('addType'), keep = sel.value;
    sel.textContent = '';
    for (const type of Glitch.TYPES) sel.append(el('option', { value: type, text: t('fx_' + type) }));
    if (keep) sel.value = keep;
  }
  function fmt(v, s) {
    const dec = s.step >= 1 ? 0 : s.step >= 0.1 ? 1 : 2;
    return Number(v).toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (s.unit ? (s.unit === '°' ? '°' : ' ' + s.unit) : '');
  }
  const optLabel = (v) => (I18N.has('o_' + v) ? t('o_' + v) : v.toUpperCase());
  const indexOf = (id) => state.stack.findIndex((L) => L.id === id);
  function moveLayer(from, to) {
    if (from < 0 || to < 0 || to >= state.stack.length || from === to) return;
    const [L] = state.stack.splice(from, 1);
    state.stack.splice(to, 0, L);
    buildLayers(); requestRender(); commit();
    const g = document.querySelector(`.layer[data-id="${L.id}"] .grip`);
    if (g) g.focus();
  }
  function rangeCtl(label, value, s, onInput, onChange, show) {
    const out = el('output', { text: show(value) });
    const input = el('input', { type: 'range', min: s.min, max: s.max, step: s.step, value });
    input.addEventListener('input', () => { out.textContent = show(+input.value); onInput(+input.value); });
    input.addEventListener('change', onChange);
    return el('label', {}, el('span', { class: 'ctl-label' }, el('span', { text: label }), out), input);
  }
  let dragId = null;
  function layerEl(L, i) {
    const open = state.open.has(L.id), bodyId = 'body-' + L.id;
    const li = el('li', { class: 'layer' + (L.on ? '' : ' off'), 'data-id': L.id, 'data-type': L.type });
    const grip = el('button', { type: 'button', class: 'btn icon grip', 'aria-label': t('drag') + ' — ' + t('fx_' + L.type), title: t('drag'), text: '⠿' });
    grip.addEventListener('pointerdown', () => { li.draggable = true; });
    const on = el('input', { type: 'checkbox', 'aria-label': t('layerOn') + ' — ' + t('fx_' + L.type), class: 'layer-on' });
    on.checked = L.on;
    on.addEventListener('change', () => { L.on = on.checked; li.classList.toggle('off', !L.on); requestRender(); commit(); });
    const title = el('button', { type: 'button', class: 'btn layer-title', 'aria-expanded': String(open), 'aria-controls': bodyId },
      el('span', { class: 'num', text: String(i + 1).padStart(2, '0') }), el('span', { class: 'name', text: t('fx_' + L.type) }));
    const body = el('div', { class: 'layer-body', id: bodyId });
    body.hidden = !open;
    title.addEventListener('click', () => {
      const o = body.hidden; body.hidden = !o; title.setAttribute('aria-expanded', String(o));
      if (o) state.open.add(L.id); else state.open.delete(L.id);
    });
    const ib = (text, label, cls, fn) => el('button', { type: 'button', class: 'btn icon ' + cls, 'aria-label': label + ' — ' + t('fx_' + L.type), title: label, text, onclick: fn });
    const dupBtn = ib('', t('duplicate'), 'dup', () => {
      const c = Glitch.makeLayer(L.type, L.params, { on: L.on, mix: L.mix, blend: L.blend });
      state.stack.splice(indexOf(L.id) + 1, 0, c); state.open.add(c.id); buildLayers(); requestRender(); commit();
    });
    // two overlapping squares (drawn, so it does not depend on a font having the glyph)
    dupBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1.5" y="4.5" width="9" height="9" rx="1.5"/><path d="M5.5 2.5h7a1.5 1.5 0 0 1 1.5 1.5v7"/></svg>';
    li.append(el('div', { class: 'layer-head' }, grip, on, title,
      ib('↑', t('moveUp'), 'up', () => moveLayer(indexOf(L.id), indexOf(L.id) - 1)),
      ib('↓', t('moveDown'), 'down', () => moveLayer(indexOf(L.id), indexOf(L.id) + 1)),
      dupBtn,
      ib('✕', t('remove'), 'del', () => { state.stack.splice(indexOf(L.id), 1); buildLayers(); requestRender(); commit(); })), body);

    // common controls: amount + blend + per-layer re-roll
    const pct = { min: 0, max: 1, step: 0.01 };
    body.append(rangeCtl(t('mix'), L.mix, pct, (v) => { L.mix = v; requestRender(); }, commit, (v) => Math.round(v * 100) + ' %'));
    const bl = el('select', { 'aria-label': t('blend') });
    for (const b of Glitch.BLENDS) bl.append(el('option', { value: b, text: t('b_' + b) }));
    bl.value = L.blend;
    bl.addEventListener('change', () => { L.blend = bl.value; requestRender(); commit(); });
    body.append(el('label', {}, el('span', { text: t('blend') }), bl));
    // effect parameters, generated from the schema
    const ctls = [];
    for (const s of Glitch.EFFECTS[L.type].params) {
      const label = t('p_' + s.key);
      let ctl;
      if (s.type === 'range') ctl = rangeCtl(label, L.params[s.key], s, (v) => { L.params[s.key] = v; requestRender(); }, commit, (v) => fmt(v, s));
      else if (s.type === 'select') {
        const se = el('select', {});
        for (const o of s.options) se.append(el('option', { value: o, text: optLabel(o) }));
        se.value = L.params[s.key];
        se.addEventListener('change', () => { L.params[s.key] = se.value; refreshVis(); requestRender(); commit(); });
        ctl = el('label', {}, el('span', { text: label }), se);
      } else {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!L.params[s.key];
        cb.addEventListener('change', () => { L.params[s.key] = cb.checked; requestRender(); commit(); });
        ctl = el('label', { class: 'check' }, cb, el('span', { text: label }));
      }
      ctl.dataset.key = s.key;
      ctls.push(ctl); body.append(ctl);
    }
    const refreshVis = () => ctls.forEach((c) => { c.hidden = !visible(L, c.dataset.key); });
    refreshVis();
    body.append(el('button', { type: 'button', class: 'btn small full', text: '🎲 ' + t('layerSeed'),
      onclick: () => { L.salt = Math.floor(Math.random() * 1e9); requestRender(); commit(); } }));

    // drag & drop reordering (started from the grip only, so sliders keep working)
    li.addEventListener('dragstart', (e) => { dragId = L.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', L.id); });
    li.addEventListener('dragend', () => { dragId = null; li.draggable = false; $$('.layer').forEach((x) => x.classList.remove('dragging', 'drag-over')); });
    li.addEventListener('dragover', (e) => { if (!dragId) return; e.preventDefault(); li.classList.add('drag-over'); });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => { if (!dragId) return; e.preventDefault(); e.stopPropagation(); const from = indexOf(dragId); dragId = null; moveLayer(from, indexOf(L.id)); });
    // keyboard reordering
    li.addEventListener('keydown', (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault(); const i0 = indexOf(L.id); moveLayer(i0, i0 + (e.key === 'ArrowUp' ? -1 : 1));
    });
    return li;
  }
  function buildLayers() {
    const ol = $('layers');
    ol.textContent = '';
    $('empty').hidden = state.stack.length > 0;
    state.stack.forEach((L, i) => ol.append(layerEl(L, i)));
  }
  function addLayer(type) {
    const L = Glitch.makeLayer(type);
    state.stack.push(L); state.open.add(L.id); state.presetId = null;
    buildLayers(); markPreset(); requestRender(); commit();
    const li = document.querySelector(`.layer[data-id="${L.id}"]`);
    if (li) { li.scrollIntoView({ block: 'nearest' }); li.querySelector('.layer-title').focus(); }
  }

  /* ------------------------------------------------------------------ view: zoom, compare, peek */
  function setZoom(z) {
    state.zoom = z;
    $('stage').classList.toggle('zoom', z === '1');
    $('fitBtn').setAttribute('aria-pressed', String(z === 'fit')); $('zoomBtn').setAttribute('aria-pressed', String(z === '1'));
    buildPreview();
  }
  function setCompare(on) {
    state.compare = on;
    $('stage').classList.toggle('cmp', on); $('cmpRow').hidden = !on; $('cmpBtn').setAttribute('aria-pressed', String(on));
    setCmp(state.cmp);
  }
  function setCmp(v) {
    state.cmp = Math.max(0, Math.min(100, v));
    origCv.style.clipPath = `inset(0 ${100 - state.cmp}% 0 0)`;
    $('cmpLine').style.left = state.cmp + '%';
    $('cmp').value = state.cmp;
  }
  function togglePlay() {
    state.playing = !state.playing;
    $('playBtn').setAttribute('aria-pressed', String(state.playing));
    if (state.playing) { animT0 = performance.now(); animTick = 0; }
    requestRender();
  }

  /* ------------------------------------------------------------------ exports */
  let exporting = false;
  function lockExports(on) { exporting = on; ['pngBtn', 'jpgBtn', 'webmBtn'].forEach((id) => { $(id).disabled = on; }); }
  const baseName = () => 'glitch-atelier-' + state.seed;
  async function exportImage(type) {
    if (exporting || !full) return;
    lockExports(true); busy(t('renderFull', { p: 0 }));
    try {
      const out = await exportR.run(full, state.stack, { seed: state.seed, k: 1, time: 0, tick: 0 }, (p) => busy(t('renderFull', { p: Math.round(p * 100) })));
      const c = el('canvas', { width: out.width, height: out.height }), cx = c.getContext('2d');
      if (type === 'image/jpeg') { cx.fillStyle = '#000'; cx.fillRect(0, 0, c.width, c.height); }
      const tmp = el('canvas', { width: out.width, height: out.height });
      tmp.getContext('2d').putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
      cx.drawImage(tmp, 0, 0);
      const q = Math.max(10, Math.min(100, Number($('jpgQ').value) || 92)) / 100;
      const blob = await new Promise((r) => c.toBlob(r, type, q));
      if (!blob) throw new Error('encode');
      download(blob, baseName() + (type === 'image/png' ? '.png' : '.jpg'));
    } catch (e) { toast(String(e.message || e)); }
    finally { busy(null); lockExports(false); }
  }
  function webmMime() {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
    for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignore */ } }
    return null;
  }
  async function exportWebm() {
    if (exporting || !full) return;
    const mime = webmMime();
    if (!mime) { $('webmNote').hidden = false; toast(t('webmUnsupported')); return; }
    const dur = Number($('vDur').value), fps = Number($('vFps').value), n = Math.round(dur * fps), vary = $('vVary').checked;
    let W = Math.min(Number($('vSize').value), full.width), H = Math.round(full.height * W / full.width);
    const budget = 450e6, bytes = W * H * 4 * n;
    if (bytes > budget) { const s = Math.sqrt(budget / bytes); W = Math.round(W * s); H = Math.round(H * s); }
    W -= W % 2; H -= H % 2; W = Math.max(2, W); H = Math.max(2, H);
    lockExports(true);
    const frames = [];
    let rec = null, holder = null;
    try {
      const sc = el('canvas', { width: W, height: H }), sx = sc.getContext('2d', { willReadFrequently: true });
      sx.imageSmoothingQuality = 'high'; sx.drawImage(fullCv, 0, 0, W, H);
      const src = { width: W, height: H, data: sx.getImageData(0, 0, W, H).data }, k = W / full.width;
      // 1. render every frame of the loop (time 0 → 1, optional new randomness per frame)
      for (let i = 0; i < n; i++) {
        busy(t('renderFrames', { i: i + 1, n }));
        const out = await exportR.run(src, state.stack, { seed: state.seed, k, time: i / n, tick: vary ? i : 0 });
        frames.push(await createImageBitmap(new ImageData(out.data, W, H)));
      }
      // 2. play them back at the exact frame rate into a recorded canvas
      busy(t('recording'));
      holder = el('canvas', { width: W, height: H, 'aria-hidden': 'true', style: 'position:fixed;left:-99999px;top:0;width:2px;height:2px' });
      document.body.append(holder);
      const hx = holder.getContext('2d');
      hx.drawImage(frames[0], 0, 0);
      const stream = holder.captureStream(fps), chunks = [];
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((r) => { rec.onstop = r; });
      rec.start(200);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        hx.drawImage(frames[i], 0, 0);
        const wait = t0 + (i + 1) * 1000 / fps - performance.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
      rec.stop(); await stopped;
      stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(chunks, { type: 'video/webm' });
      if (!blob.size) throw new Error(t('webmUnsupported'));
      download(blob, baseName() + '.webm');
    } catch (e) { toast(String(e.message || e)); }
    finally { frames.forEach((b) => b.close && b.close()); if (holder) holder.remove(); busy(null); lockExports(false); }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(Glitch.serialize(state), null, 2)], { type: 'application/json' });
    download(blob, baseName() + '.json');
  }
  async function importJson(file) {
    try { applyState(Glitch.deserialize(JSON.parse(await file.text()))); toast(t('imported')); } catch (e) { toast(t('importError')); }
  }
  async function share() {
    const url = location.href.split('#')[0] + '#' + Glitch.toHash(state), out = $('shareOut');
    out.hidden = false; out.value = url;
    try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch (e) { out.select(); toast(t('copyManual')); }
  }

  /* ------------------------------------------------------------------ languages */
  function applyLang() {
    const kab = state.lang === 'kab';
    document.documentElement.lang = kab && state.tfng ? 'kab-Tfng' : state.lang;
    document.body.classList.toggle('tfng-on', kab && state.tfng);
    $('lang').value = state.lang; $('tfngWrap').hidden = !kab; $('tfng').checked = state.tfng;
    $$('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    $$('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); });
    $$('[data-i18n-aria]').forEach((e) => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
    $('helpBody').innerHTML = t('helpHtml'); // static string from our own dictionary
    buildAddSelect(); buildPresets(); buildLayers(); updateInfo();
  }

  /* ------------------------------------------------------------------ events */
  function bind() {
    $('openBtn').addEventListener('click', () => $('file').click());
    $('file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
    $('demoBtn').addEventListener('click', loadDemo);
    $('undoBtn').addEventListener('click', undo); $('redoBtn').addEventListener('click', redo);
    $('fitBtn').addEventListener('click', () => setZoom('fit')); $('zoomBtn').addEventListener('click', () => setZoom('1'));
    $('cmpBtn').addEventListener('click', () => setCompare(!state.compare));
    $('cmp').addEventListener('input', (e) => setCmp(+e.target.value));
    $('playBtn').addEventListener('click', togglePlay);
    $('surpriseBtn').addEventListener('click', surprise);
    $('rerollBtn').addEventListener('click', reroll);
    $('seed').addEventListener('change', (e) => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)) >>> 0; state.seed = v; e.target.value = v; requestRender(); commit(); });
    $('previewSize').addEventListener('change', (e) => { state.previewMax = Number(e.target.value); store.set('preview', state.previewMax); buildPreview(); });
    $('addBtn').addEventListener('click', () => addLayer($('addType').value));
    $('clearBtn').addEventListener('click', () => { state.stack = []; state.presetId = null; syncAll(); commit(); });
    $('pngBtn').addEventListener('click', () => exportImage('image/png'));
    $('jpgBtn').addEventListener('click', () => exportImage('image/jpeg'));
    $('webmBtn').addEventListener('click', exportWebm);
    $('jsonBtn').addEventListener('click', exportJson);
    $('importBtn').addEventListener('click', () => $('jsonFile').click());
    $('jsonFile').addEventListener('change', (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
    $('shareBtn').addEventListener('click', share);
    $('lang').addEventListener('change', (e) => { state.lang = e.target.value; store.set('lang', state.lang); applyLang(); });
    $('tfng').addEventListener('change', (e) => { state.tfng = e.target.checked; store.set('tfng', state.tfng); applyLang(); });
    const dlg = $('help');
    $('helpBtn').addEventListener('click', () => dlg.showModal());
    $('helpClose').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    // compare: drag directly on the image
    const wrapEl = $('wrap');
    let cmpDrag = false;
    const cmpAt = (e) => { const r = wrapEl.getBoundingClientRect(); setCmp((e.clientX - r.left) / r.width * 100); };
    wrapEl.addEventListener('pointerdown', (e) => { if (!state.compare) return; cmpDrag = true; wrapEl.setPointerCapture(e.pointerId); cmpAt(e); });
    wrapEl.addEventListener('pointermove', (e) => { if (cmpDrag) cmpAt(e); });
    wrapEl.addEventListener('pointerup', () => { cmpDrag = false; });

    // files: drag & drop anywhere, paste
    const stage = $('stage');
    let dragDepth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    document.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; stage.classList.add('dragging'); });
    document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    document.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) stage.classList.remove('dragging'); });
    document.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); dragDepth = 0; stage.classList.remove('dragging');
      const f = Array.from(e.dataTransfer.files).find((x) => /^image\//.test(x.type)) || e.dataTransfer.files[0];
      if (f && /json/.test(f.type)) importJson(f); else loadFile(f);
    });
    document.addEventListener('paste', (e) => {
      const it = Array.from((e.clipboardData && e.clipboardData.items) || []).find((x) => x.type.startsWith('image/'));
      if (it) { e.preventDefault(); loadFile(it.getAsFile()); }
    });

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tg = e.target, typing = /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName) && !(tg.tagName === 'INPUT' && ['range', 'checkbox', 'button'].includes(tg.type));
      const k = (e.key || '').toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (e.altKey) return;
        if (k === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        else if (k === 'y' && !typing) { e.preventDefault(); redo(); }
        else if (k === 's') { e.preventDefault(); exportImage('image/png'); }
        return;
      }
      if (typing || e.altKey || dlg.open) return;
      if (k === 'r') reroll();
      else if (k === 's') surprise();
      else if (k === 'p') togglePlay();
      else if (k === 'c') setCompare(!state.compare);
      else if (k === 'f') setZoom('fit');
      else if (k === '1') setZoom('1');
      else if (k === 'o') $('file').click();
      else if (e.key === '?') dlg.showModal();
      else if (k === 'b' && !e.repeat) stage.classList.add('peek');
    });
    document.addEventListener('keyup', (e) => { if ((e.key || '').toLowerCase() === 'b') stage.classList.remove('peek'); });
    window.addEventListener('blur', () => stage.classList.remove('peek'));
    window.addEventListener('hashchange', () => {
      if (location.hash === lastHash) return;
      try { const st = Glitch.fromHash(location.hash); if (st) { applyState(st); toast(t('hashLoaded')); } } catch (e) { /* ignore bad links */ }
    });
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    state.previewMax = [640, 1000, 1400].includes(store.get('preview', 1000)) ? store.get('preview', 1000) : 1000;
    $('previewSize').value = state.previewMax;
    bind();
    applyLang();
    if (!webmMime()) $('webmNote').hidden = false;
    loadDemo();
    let restored = false;
    if (/[#&]g=/.test(location.hash)) {
      try { const st = Glitch.fromHash(location.hash); if (st) { applyState(st); restored = true; toast(t('hashLoaded')); } } catch (e) { /* ignore */ }
    }
    if (!restored) applyState(Presets.build('cyber', Glitch), 'cyber');
    setCmp(50); updateHistButtons();
  }
  boot();

  // Small hook for the automated tests and for curious users in the console.
  window.GlitchApp = {
    state, loadPreset, addLayer, undo, redo, reroll, setZoom, setCompare, exportImage, exportWebm, webmMime,
    get renderCount() { return renderCount; }, get usingWorker() { return previewR.worker; },
    idle: () => new Promise((r) => { if (!rendering && !dirty) r(); else idleWaiters.push(r); }),
  };
})();
