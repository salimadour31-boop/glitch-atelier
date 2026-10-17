/* presets.js — Glitch Atelier factory presets (original combinations). Each preset is a seed plus a stack of
 * [type, params, { mix, blend }] entries; the names come from the i18n dictionary (key "pr_<id>"). MIT licence. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Presets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LIST = [
    { id: 'vhs', seed: 1987, stack: [
      ['vhs', { bands: 3, jitter: 30, noise: 0.35, bleed: 6, desat: 0.3, head: 0.7 }],
      ['chroma', { amount: 5 }],
      ['crt', { lines: 0.3, curve: 0.08, vignette: 0.35, mask: 0.1, bright: 1.12 }],
      ['noise', { amount: 0.1, size: 2 }, { mix: 0.8 }]] },
    { id: 'datamosh', seed: 404, stack: [
      ['jpeg', { quality: 10, corrupt: 0.28, drift: 0.75, block: 16 }],
      ['slices', { count: 12, shift: 18, thick: 4, blocks: true, chan: 0.4 }],
      ['sort', { dir: 'v', low: 0.45, high: 0.95, maxLen: 260, jitter: 0.5 }, { mix: 0.85 }]] },
    { id: 'sortSoft', seed: 7, stack: [
      ['sort', { key: 'luma', dir: 'h', low: 0.3, high: 0.88, jitter: 0.45 }, { mix: 0.9 }],
      ['noise', { amount: 0.06, mono: true }]] },
    { id: 'cyber', seed: 2077, stack: [
      ['rgb', { rx: 16, bx: -16, gy: 3 }],
      ['slices', { count: 30, shift: 9, thick: 1.2, chan: 0.65 }],
      ['posterize', { levels: 5 }, { mix: 0.45, blend: 'screen' }],
      ['crt', { lines: 0.35, curve: 0, vignette: 0.25, mask: 0.3, bright: 1.1 }]] },
    { id: 'neonCrt', seed: 88, stack: [
      ['posterize', { levels: 4 }],
      ['chroma', { amount: 12, falloff: 1.2 }],
      ['crt', { lines: 0.7, spacing: 5, curve: 0.45, mask: 0.55, vignette: 0.6, bright: 1.35 }]] },
    { id: 'kaleido', seed: 12, stack: [
      ['mirror', { mode: 'kaleido', segments: 8, rotate: 15 }],
      ['rgb', { rx: 6, bx: -6 }],
      ['wave', { axis: 'both', amp: 6, length: 260 }, { mix: 0.7 }]] },
    { id: 'bitcrush', seed: 8, stack: [
      ['pixelate', { size: 16 }],
      ['posterize', { levels: 3, dither: true }],
      ['noise', { amount: 0.08, mono: true }]] },
    { id: 'liquid', seed: 33, stack: [
      ['wave', { axis: 'both', amp: 28, length: 220, split: 0.55 }],
      ['chroma', { amount: 7 }]] },
    { id: 'lostSignal', seed: 1312, stack: [
      ['vhs', { bands: 6, bandH: 9, jitter: 80, noise: 0.85, head: 1, desat: 0.5 }],
      ['slices', { count: 14, shift: 14, thick: 2 }],
      ['noise', { amount: 0.3, lines: 0.7 }],
      ['crt', { lines: 0.45, curve: 0.2, vignette: 0.5, flicker: 0.5 }]] },
    { id: 'melt', seed: 451, stack: [
      ['melt', { amount: 0.45, density: 0.7, width: 5, threshold: 0.25 }],
      ['sort', { dir: 'v', low: 0.55, high: 1, reverse: true }, { mix: 0.7 }],
      ['posterize', { levels: 8 }, { mix: 0.5 }]] },
    { id: 'prism', seed: 3, stack: [
      ['mirror', { mode: 'lr' }],
      ['rgb', { rx: 22, gy: 8, bx: -22, swap: 'gbr' }, { mix: 0.75, blend: 'lighten' }],
      ['chroma', { amount: 14 }]] },
  ];
  /** Build the { seed, stack } state of a preset with an engine (Glitch). Salts derive from the seed → reproducible. */
  function build(id, G) {
    const p = LIST.find((x) => x.id === id);
    if (!p) return null;
    return { seed: p.seed, stack: p.stack.map(([type, params, extra], i) => G.makeLayer(type, params, Object.assign({ salt: G.hashInts(p.seed, i, 99) }, extra || {}))) };
  }
  return { LIST, build };
});
