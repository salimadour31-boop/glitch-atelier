// Engine unit tests (Node, no dependency): node tests/engine.test.js
// Every effect changes pixels and is deterministic for a given seed, schema clamping, blend modes,
// presets, JSON / URL-hash round trips, resolution independence of seeded effects.
const assert = require('assert');
const G = require('../js/effects.js'), Presets = require('../js/presets.js');
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('  ✓ ' + name); };

/** Procedural test image: gradients + bars + a disc (no external file). */
function testImage(W, H) {
  const img = G.make(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = (y * W + x) * 4, u = x / W, v = y / H, disc = Math.hypot(u - 0.6, v - 0.45) < 0.22;
    d[j] = disc ? 250 : 255 * u; d[j + 1] = disc ? 200 : 255 * v; d[j + 2] = (Math.floor(x / 23) % 3) * 110; d[j + 3] = 255;
  }
  return img;
}
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); return s / (a.data.length / 4) / 3; };

(async () => {
  const src = testImage(160, 100), copy = G.clone(src);
  console.log('Effects');
  for (const type of G.TYPES) {
    await test(`${type}: changes pixels, deterministic, keeps size, source untouched`, async () => {
      const L = G.makeLayer(type, {}, { salt: 42 });
      const a = await G.render(src, [L], { seed: 5 }), b = await G.render(src, [L], { seed: 5 });
      assert.strictEqual(a.width, 160); assert.strictEqual(a.height, 100);
      assert(diff(a, src) > 0.5, `${type} did not change the image (${diff(a, src)})`);
      assert.strictEqual(diff(a, b), 0, `${type} not deterministic`);
      assert.strictEqual(diff(src, copy), 0, 'source mutated');
    });
  }
  await test('seeded effects differ with another seed', async () => {
    for (const type of ['slices', 'jpeg', 'noise', 'vhs', 'melt']) {
      const L = G.makeLayer(type, type === 'jpeg' ? { corrupt: 0.6 } : {}, { salt: 1 });
      const a = await G.render(src, [L], { seed: 1 }), b = await G.render(src, [L], { seed: 2 });
      assert(diff(a, b) > 0.1, type + ' ignores the seed');
    }
  });
  await test('every select option of every effect renders', async () => {
    for (const type of G.TYPES) for (const s of G.EFFECTS[type].params) if (s.type === 'select') for (const opt of s.options) {
      const out = await G.render(src, [G.makeLayer(type, { [s.key]: opt }, { salt: 3 })], { seed: 9 });
      assert.strictEqual(out.data.length, src.data.length, `${type}.${s.key}=${opt}`);
    }
  });
  await test('pixel sort produces monotonic runs on a row (horizontal, full mask)', async () => {
    const out = await G.render(src, [G.makeLayer('sort', { low: 0, high: 1 })], { seed: 1 });
    const d = out.data, W = 160; let prev = -1;
    for (let x = 0; x < W; x++) { const j = (50 * W + x) * 4, l = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]; assert(l >= prev - 1e-6); prev = l; }
  });
  await test('mix 0 / disabled layer leave the image unchanged; blend modes valid', async () => {
    const off = await G.render(src, [G.makeLayer('rgb', {}, { on: false })], { seed: 1 });
    assert.strictEqual(diff(off, src), 0);
    const half = await G.render(src, [G.makeLayer('posterize', { levels: 2 }, { mix: 0.5 })], { seed: 1 });
    const full = await G.render(src, [G.makeLayer('posterize', { levels: 2 }, { mix: 1 })], { seed: 1 });
    assert(diff(half, src) < diff(full, src));
    for (const b of G.BLENDS) { const o = await G.render(src, [G.makeLayer('wave', {}, { blend: b })], { seed: 1 }); assert(o.data.every((v) => v >= 0 && v <= 255)); }
  });
  await test('normParams clamps ranges and rejects bad options', () => {
    const p = G.normParams('rgb', { rx: 9999, swap: 'xyz', wrap: 'nope' });
    assert.strictEqual(p.rx, 300); assert.strictEqual(p.swap, 'rgb'); assert.strictEqual(p.wrap, true);
  });
  await test('slices are resolution independent (same layout at half size)', async () => {
    const big = testImage(320, 200), small = testImage(160, 100), L = G.makeLayer('slices', { count: 6, shift: 30, thick: 8 }, { salt: 7 });
    const a = await G.render(big, [L], { seed: 3, k: 1 }), b = await G.render(small, [L], { seed: 3, k: 0.5 });
    // compare a down-sampled version of a with b
    let s = 0, c = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 160; x++) { s += Math.abs(a.data[((2 * y) * 320 + 2 * x) * 4] - b.data[(y * 160 + x) * 4]); c++; }
    assert(s / c < 25, 'layouts differ ' + s / c);
  });
  console.log('Presets & settings');
  await test(`${Presets.LIST.length} presets build and render`, async () => {
    assert(Presets.LIST.length >= 10);
    for (const p of Presets.LIST) { const st = Presets.build(p.id, G); assert(st.stack.length > 0); const o = await G.render(src, st.stack, { seed: st.seed }); assert(diff(o, src) > 1, p.id); }
  });
  await test('JSON round trip keeps the render identical', async () => {
    const st = Presets.build('datamosh', G), json = JSON.parse(JSON.stringify(G.serialize(st))), back = G.deserialize(json);
    const a = await G.render(src, st.stack, { seed: st.seed }), b = await G.render(src, back.stack, { seed: back.seed });
    assert.strictEqual(diff(a, b), 0); assert.strictEqual(json.app, 'glitch-atelier');
  });
  await test('URL hash round trip keeps the render identical; garbage rejected', async () => {
    const st = Presets.build('cyber', G); st.stack[0].params.rx = -33; st.stack[1].on = false;
    const h = G.toHash(st), back = G.fromHash('#' + h);
    assert(/^g=[A-Za-z0-9_-]+$/.test(h));
    assert.strictEqual(back.seed, st.seed); assert.strictEqual(back.stack[0].params.rx, -33); assert.strictEqual(back.stack[1].on, false);
    const a = await G.render(src, st.stack, { seed: st.seed }), b = await G.render(src, back.stack, { seed: back.seed });
    assert.strictEqual(diff(a, b), 0);
    assert.strictEqual(G.fromHash('#nothing'), null);
    assert.throws(() => G.deserialize({ foo: 1 }));
    assert.strictEqual(G.deserialize({ seed: 1, stack: [{ type: 'evil' }, { type: 'noise' }] }).stack.length, 1);
  });
  await test('jpeg bytes mode falls back to the simulated codec without OffscreenCanvas', async () => {
    const o = await G.render(src, [G.makeLayer('jpeg', { mode: 'bytes' }, { salt: 1 })], { seed: 1 });
    assert(diff(o, src) > 0.5);
  });
  await test('animation: time changes wave / vhs, tick changes noise', async () => {
    const w = G.makeLayer('wave', {}, { salt: 1 }), v = G.makeLayer('vhs', {}, { salt: 1 }), z = G.makeLayer('noise', {}, { salt: 1 });
    assert(diff(await G.render(src, [w], { time: 0 }), await G.render(src, [w], { time: 0.3 })) > 0.5);
    assert(diff(await G.render(src, [v], { time: 0, tick: 0 }), await G.render(src, [v], { time: 0.3, tick: 0 })) > 0.1);
    assert(diff(await G.render(src, [z], { tick: 0 }), await G.render(src, [z], { tick: 1 })) > 0.5);
  });
  await test('performance: whole datamosh stack on 1000×625 under 4 s', async () => {
    const big = testImage(1000, 625), st = Presets.build('lostSignal', G), t0 = Date.now();
    await G.render(big, st.stack, { seed: 1 });
    const t = Date.now() - t0; console.log('    (' + t + ' ms)'); assert(t < 4000);
  });
  console.log(`\n${n} engine tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
