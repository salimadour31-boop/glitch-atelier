/* effects.js — Glitch Atelier engine: seeded random, effect schema, the 13 glitch effects, blend modes,
 * the non-destructive render pipeline and settings (de)serialisation (JSON + URL hash).
 * Pure JavaScript working on { width, height, data: Uint8ClampedArray RGBA } objects, so the same code runs in the
 * Web Worker, on the main thread (fallback) and in Node for the unit tests. Original code — MIT licence. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Glitch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  /** Small, fast 32-bit seeded generator (returns floats in [0, 1)). */
  function rng32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** FNV-1a style hash of a list of integers → unsigned 32-bit seed. */
  function hashInts() {
    let h = 0x811c9dc5;
    for (let a = 0; a < arguments.length; a++) {
      let x = arguments[a] | 0;
      for (let i = 0; i < 4; i++) { h ^= x & 255; h = Math.imul(h, 16777619); x >>>= 8; }
    }
    return h >>> 0;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrap = (v, n) => { v %= n; return v < 0 ? v + n : v; };
  const frac = (v) => v - Math.floor(v);
  const make = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
  const clone = (img) => ({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) });
  const u32 = (img) => new Uint32Array(img.data.buffer, img.data.byteOffset, img.width * img.height);
  const luma8 = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  /** Bilinear sample of one channel c at continuous pixel coords (x, y), edges clamped. */
  function bil(d, W, H, x, y, c) {
    x -= 0.5; y -= 0.5;
    let x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    let x1 = x0 + 1, y1 = y0 + 1;
    x0 = clamp(x0, 0, W - 1); x1 = clamp(x1, 0, W - 1); y0 = clamp(y0, 0, H - 1); y1 = clamp(y1, 0, H - 1);
    const a = d[(y0 * W + x0) * 4 + c], b = d[(y0 * W + x1) * 4 + c], e = d[(y1 * W + x0) * 4 + c], f = d[(y1 * W + x1) * 4 + c];
    return (a + (b - a) * fx) * (1 - fy) + (e + (f - e) * fx) * fy;
  }

  /* ------------------------------------------------------------------ parameter schema */
  const R = (key, min, max, step, def, unit) => ({ key, type: 'range', min, max, step, def, unit: unit || '' });
  const S = (key, options, def) => ({ key, type: 'select', options, def });
  const B = (key, def) => ({ key, type: 'bool', def });

  /* ------------------------------------------------------------------ effects
   * Every effect: { params: [...schema], run(img, p, rng, ctx) → new image (or Promise of one) }.
   * ctx.k = working width / full-resolution width (pixel parameters are expressed at full resolution),
   * ctx.time = loop phase in [0, 1) for animation, ctx.tick = frame counter (re-seeds the randomness). */
  const EFFECTS = {};

  /* Pixel sorting: spans of pixels whose key lies inside (or outside) [low, high] are sorted along lines. */
  EFFECTS.sort = {
    params: [S('key', ['luma', 'hue', 'sat', 'red', 'green', 'blue'], 'luma'), S('dir', ['h', 'v', 'angle'], 'h'),
      R('angle', 0, 180, 1, 30, '°'), R('low', 0, 1, 0.01, 0.25), R('high', 0, 1, 0.01, 0.8), S('mask', ['inside', 'outside'], 'inside'),
      B('reverse', false), R('maxLen', 0, 2000, 10, 0, 'px'), R('jitter', 0, 1, 0.01, 0)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, src = u32(img);
      const out = clone(img), dst = u32(out), key = new Float32Array(W * H);
      for (let i = 0, j = 0; i < W * H; i++, j += 4) {
        const r = d[j], g = d[j + 1], b = d[j + 2];
        let v;
        if (p.key === 'luma') v = luma8(r, g, b) / 255;
        else if (p.key === 'red') v = r / 255;
        else if (p.key === 'green') v = g / 255;
        else if (p.key === 'blue') v = b / 255;
        else {
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
          if (p.key === 'sat') v = mx ? c / mx : 0;
          else if (!c) v = 0;
          else {
            let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
            v = (h < 0 ? h + 6 : h) / 6;
          }
        }
        key[i] = v;
      }
      const lo = Math.min(p.low, p.high), hi = Math.max(p.low, p.high), inside = p.mask !== 'outside';
      const inMask = (v) => (v >= lo && v <= hi) === inside;
      const lim = p.maxLen > 0 ? Math.max(2, p.maxLen * ctx.k) : 0;
      const sign = p.reverse ? -1 : 1;
      const cmp = (a, b) => sign * (key[a] - key[b]);
      const line = (idx, n) => {
        const base = lim || n;
        let s = 0;
        while (s < n) {
          if (!inMask(key[idx[s]])) { s++; continue; }
          const L = Math.max(2, base * (1 - p.jitter * rng()));
          let e = s;
          while (e < n && e - s < L && inMask(key[idx[e]])) e++;
          if (e - s > 1) {
            const seg = Array.prototype.slice.call(idx, s, e).sort(cmp);
            for (let q = 0; q < seg.length; q++) dst[idx[s + q]] = src[seg[q]];
          }
          s = e;
        }
      };
      const dir = p.dir === 'h' ? 0 : p.dir === 'v' ? 90 : p.angle;
      if (dir === 0 || dir === 180) {
        const idx = new Int32Array(W);
        for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) idx[x] = y * W + x; line(idx, W); }
      } else if (dir === 90) {
        const idx = new Int32Array(H);
        for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) idx[y] = y * W + x; line(idx, H); }
      } else {
        // Generic angle: walk lines along d = (cos, sin), offset along the normal n = (−sin, cos).
        const a = dir * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
        let omin = Infinity, omax = -Infinity, tmin = Infinity, tmax = -Infinity;
        for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
          const o = -x * dy + y * dx, t = x * dx + y * dy;
          omin = Math.min(omin, o); omax = Math.max(omax, o); tmin = Math.min(tmin, t); tmax = Math.max(tmax, t);
        }
        const seen = new Uint8Array(W * H), idx = new Int32Array(Math.ceil(tmax - tmin) + 4);
        for (let o = omin; o <= omax; o += 0.7) {
          let n = 0;
          for (let t = tmin; t <= tmax; t += 1) {
            const x = Math.floor(t * dx - o * dy), y = Math.floor(t * dy + o * dx);
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = y * W + x;
            if (seen[i]) continue;
            seen[i] = 1; idx[n++] = i;
          }
          if (n) line(idx, n);
        }
      }
      return out;
    },
  };

  /* RGB split: each channel taken from an offset position, optional channel swap. */
  const SWAPS = { rgb: [0, 1, 2], rbg: [0, 2, 1], grb: [1, 0, 2], gbr: [1, 2, 0], brg: [2, 0, 1], bgr: [2, 1, 0] };
  EFFECTS.rgb = {
    params: [R('rx', -300, 300, 1, 14, 'px'), R('ry', -300, 300, 1, 0, 'px'), R('gx', -300, 300, 1, 0, 'px'), R('gy', -300, 300, 1, 0, 'px'),
      R('bx', -300, 300, 1, -14, 'px'), R('by', -300, 300, 1, 0, 'px'), S('swap', Object.keys(SWAPS), 'rgb'), B('wrap', true)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data;
      const ox = [p.rx, p.gx, p.bx].map((v) => Math.round(v * ctx.k)), oy = [p.ry, p.gy, p.by].map((v) => Math.round(v * ctx.k));
      const ord = SWAPS[p.swap] || SWAPS.rgb;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const j = (y * W + x) * 4;
          for (let c = 0; c < 3; c++) {
            let sx = x - ox[c], sy = y - oy[c];
            if (p.wrap) { sx = wrap(sx, W); sy = wrap(sy, H); } else { sx = clamp(sx, 0, W - 1); sy = clamp(sy, 0, H - 1); }
            o[j + c] = d[(sy * W + sx) * 4 + ord[c]];
          }
          o[j + 3] = d[j + 3];
        }
      }
      return out;
    },
  };

  /* Chromatic aberration: red pushed outward, blue inward from a centre, growing with the radius. */
  EFFECTS.chroma = {
    params: [R('amount', 0, 120, 0.5, 10, 'px'), R('cx', 0, 1, 0.01, 0.5), R('cy', 0, 1, 0.01, 0.5), R('falloff', 0.3, 4, 0.05, 1.6)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data;
      const Cx = p.cx * W, Cy = p.cy * H, maxR = Math.hypot(Math.max(Cx, W - Cx), Math.max(Cy, H - Cy)) || 1;
      const amt = p.amount * ctx.k;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const j = (y * W + x) * 4, px = x + 0.5, py = y + 0.5, vx = px - Cx, vy = py - Cy, len = Math.hypot(vx, vy);
          if (len < 1e-6) { o[j] = d[j]; o[j + 1] = d[j + 1]; o[j + 2] = d[j + 2]; o[j + 3] = d[j + 3]; continue; }
          const s = amt * Math.pow(len / maxR, p.falloff) / len, ux = vx * s, uy = vy * s;
          o[j] = bil(d, W, H, px - ux, py - uy, 0);
          o[j + 1] = bil(d, W, H, px - ux * 0.25, py - uy * 0.25, 1);
          o[j + 2] = bil(d, W, H, px + ux, py + uy, 2);
          o[j + 3] = d[j + 3];
        }
      }
      return out;
    },
  };

  /* Slice / block displacement: seeded horizontal slices (or rectangular blocks) shifted, some on one channel only. */
  EFFECTS.slices = {
    params: [R('count', 1, 120, 1, 18), R('shift', 0, 100, 0.5, 12, '%'), R('thick', 0.2, 25, 0.1, 3, '%'), B('blocks', false),
      R('chan', 0, 1, 0.01, 0.3), B('wrap', true)],
    run(img, p, rng) {
      const W = img.width, H = img.height, src = u32(img), out = clone(img), dst = u32(out), d = img.data, o = out.data;
      const maxShift = p.shift / 100 * W, avgH = Math.max(1, p.thick / 100 * H);
      for (let i = 0; i < p.count; i++) {
        // Always draw the same amount of random numbers so one setting does not reshuffle the others.
        const r = [rng(), rng(), rng(), rng(), rng(), rng(), rng(), rng()];
        const y0 = Math.floor(r[0] * H), h = Math.max(1, Math.round(avgH * (0.25 + r[1] * 1.5)));
        const dx = Math.round((r[2] * 2 - 1) * maxShift);
        let x0 = 0, w = W, dy = 0;
        if (p.blocks) { w = Math.max(2, Math.round(W * (0.05 + r[3] * 0.35))); x0 = Math.floor(r[4] * W); dy = Math.round((r[5] * 2 - 1) * avgH * 0.6); }
        const ch = r[6] < p.chan ? Math.floor(r[7] * 3) : -1;
        for (let y = y0; y < Math.min(H, y0 + h); y++) {
          for (let x = x0; x < Math.min(W, x0 + w); x++) {
            let sx = x - dx, sy = y - dy;
            if (p.wrap) { sx = wrap(sx, W); sy = wrap(sy, H); } else { sx = clamp(sx, 0, W - 1); sy = clamp(sy, 0, H - 1); }
            if (ch < 0) dst[y * W + x] = src[sy * W + sx];
            else o[(y * W + x) * 4 + ch] = d[(sy * W + sx) * 4 + ch];
          }
        }
      }
      return out;
    },
  };

  /* JPEG corruption. "dct": simulated block DCT codec (YCbCr, chroma subsampling, quantisation) with seeded
   * coefficient errors, DC drift along block rows and repeated blocks. "bytes": the image is really encoded
   * as JPEG (OffscreenCanvas), random bytes of the entropy-coded data are altered and the file is decoded again;
   * if the browser cannot do that or the file no longer decodes, the simulated codec is used instead. */
  const cosCache = {};
  function cosTable(N) {
    if (cosCache[N]) return cosCache[N];
    const C = new Float64Array(N * N);
    for (let u = 0; u < N; u++) for (let x = 0; x < N; x++) C[u * N + x] = (u ? Math.sqrt(2 / N) : Math.sqrt(1 / N)) * Math.cos((2 * x + 1) * u * Math.PI / (2 * N));
    return (cosCache[N] = C);
  }
  function jpegSim(img, p, rng, ctx) {
    const W = img.width, H = img.height, d = img.data, n = W * H;
    const N = clamp(Math.round(p.block * ctx.k), 4, 32), C = cosTable(N), NN = N * N;
    const Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const r = d[j], g = d[j + 1], b = d[j + 2];
      Y[i] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
      Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
      Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    if (p.subsample) for (const P of [Cb, Cr]) {
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const x1 = Math.min(x + 1, W - 1), y1 = Math.min(y + 1, H - 1);
        const m = (P[y * W + x] + P[y * W + x1] + P[y1 * W + x] + P[y1 * W + x1]) / 4;
        P[y * W + x] = P[y * W + x1] = P[y1 * W + x] = P[y1 * W + x1] = m;
      }
    }
    const q = clamp(p.quality, 1, 100), qs = q < 50 ? 5000 / q : 200 - 2 * q;
    const QL = new Float32Array(NN), QC = new Float32Array(NN);
    for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) {
      const f = (u + v) * 8 / N;
      QL[u * N + v] = Math.max(1, (16 + 7 * f) * qs / 100) * N / 8;
      QC[u * N + v] = Math.max(1, (17 + 12 * f) * qs / 100) * N / 8;
    }
    const planes = [Y, Cb, Cr], quant = [QL, QC, QC];
    const f = new Float64Array(NN), tmp = new Float64Array(NN), F = new Float64Array(NN);
    const prev = [new Float64Array(NN), new Float64Array(NN), new Float64Array(NN)], dcErr = [0, 0, 0];
    const bw = Math.ceil(W / N), bh = Math.ceil(H / N);
    for (let by = 0; by < bh; by++) {
      if (rng() > p.drift) dcErr[0] = dcErr[1] = dcErr[2] = 0; // a "restart marker" clears the drift
      for (let bx = 0; bx < bw; bx++) {
        const r = [rng(), rng(), rng(), rng(), rng(), rng(), rng(), rng()];
        const hit = r[0] < p.corrupt, repeat = hit && r[1] < 0.3 * p.drift + 0.05;
        for (let c = 0; c < 3; c++) {
          const P = planes[c], Q = quant[c];
          // load block (edge pixels clamped)
          for (let y = 0; y < N; y++) {
            const sy = Math.min(by * N + y, H - 1);
            for (let x = 0; x < N; x++) f[y * N + x] = P[sy * W + Math.min(bx * N + x, W - 1)];
          }
          // forward DCT, rows then columns:  F = C · f · Cᵀ
          for (let y = 0; y < N; y++) for (let u = 0; u < N; u++) { let s = 0; for (let x = 0; x < N; x++) s += C[u * N + x] * f[y * N + x]; tmp[y * N + u] = s; }
          for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) { let s = 0; for (let y = 0; y < N; y++) s += C[v * N + y] * tmp[y * N + u]; F[v * N + u] = Math.round(s / Q[v * N + u]); }
          if (repeat) F.set(prev[c]);
          else if (hit) {
            // a few low-frequency coefficients get garbage, and the DC value starts drifting
            // amplitudes are given in coefficient units (÷ Q) so low qualities do not saturate everything
            const k = 1 + Math.floor(r[2] * 4);
            for (let m = 0; m < k; m++) {
              const zi = Math.floor(rng() * Math.min(NN, 10)), uu = zi % 4, vv = Math.floor(zi / 4);
              F[vv * N + uu] += Math.round((rng() * 2 - 1) * (40 + 220 * r[3]) * N / 8 / Q[vv * N + uu]);
            }
            dcErr[c] += (r[4] * 2 - 1) * 45 * N * p.drift / Q[0];
          }
          const lim = 70 * N / Q[0];
          dcErr[c] = clamp(dcErr[c] * (0.82 + 0.16 * p.drift), -lim, lim); // the error fades along the row
          F[0] += Math.round(dcErr[c]);
          prev[c].set(F);
          // dequantise + inverse DCT:  f = Cᵀ · F · C
          for (let i = 0; i < NN; i++) F[i] *= Q[i];
          for (let v = 0; v < N; v++) for (let x = 0; x < N; x++) { let s = 0; for (let u = 0; u < N; u++) s += C[u * N + x] * F[v * N + u]; tmp[v * N + x] = s; }
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let v = 0; v < N; v++) s += C[v * N + y] * tmp[v * N + x]; f[y * N + x] = s; }
          for (let y = 0; y < N && by * N + y < H; y++) for (let x = 0; x < N && bx * N + x < W; x++) P[(by * N + y) * W + bx * N + x] = f[y * N + x];
        }
      }
    }
    const out = make(W, H), o = out.data;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const y = Y[i] + 128, cb = Cb[i], cr = Cr[i];
      o[j] = y + 1.402 * cr; o[j + 1] = y - 0.344136 * cb - 0.714136 * cr; o[j + 2] = y + 1.772 * cb; o[j + 3] = d[j + 3];
    }
    return out;
  }
  async function jpegBytes(img, p, rng) {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined' || typeof ImageData === 'undefined') return null;
    try {
      const W = img.width, H = img.height, cv = new OffscreenCanvas(W, H), cx = cv.getContext('2d');
      cx.putImageData(new ImageData(new Uint8ClampedArray(img.data), W, H), 0, 0);
      const blob = await cv.convertToBlob({ type: 'image/jpeg', quality: clamp(p.quality, 1, 100) / 100 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let sos = -1;
      for (let i = 2; i < bytes.length - 4; i++) if (bytes[i] === 0xff && bytes[i + 1] === 0xda) { sos = i; break; }
      if (sos < 0) return null;
      const start = sos + 2 + ((bytes[sos + 2] << 8) | bytes[sos + 3]), end = bytes.length - 2, span = end - start;
      if (span < 16) return null;
      const hits = 1 + Math.round(p.corrupt * 60);
      for (let m = 0; m < hits; m++) {
        // skip the first 3 % so the top of the image stays readable, never write marker bytes (0xFF)
        const pos = start + Math.floor(span * (0.03 + 0.97 * rng())), v = Math.floor(rng() * 255);
        if (bytes[pos] === 0xff || bytes[pos - 1] === 0xff) continue;
        bytes[pos] = v;
      }
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      cx.clearRect(0, 0, W, H); cx.drawImage(bmp, 0, 0, W, H); bmp.close && bmp.close();
      const id = cx.getImageData(0, 0, W, H);
      return { width: W, height: H, data: id.data };
    } catch (e) { return null; }
  }
  EFFECTS.jpeg = {
    params: [S('mode', ['dct', 'bytes'], 'dct'), R('quality', 1, 100, 1, 18), R('corrupt', 0, 1, 0.01, 0.15), R('drift', 0, 1, 0.01, 0.5),
      R('block', 8, 32, 1, 8, 'px'), B('subsample', true)],
    run(img, p, rng, ctx) {
      if (p.mode !== 'bytes') return jpegSim(img, p, rng, ctx);
      const seed = Math.floor(rng() * 4294967296);
      return jpegBytes(img, p, rng).then((res) => res || jpegSim(img, p, rng32(seed), ctx));
    },
  };

  /* VHS: tracking bands that scroll, line wobble, head-switching noise, chroma bleed, desaturation and tape noise. */
  EFFECTS.vhs = {
    params: [R('bands', 0, 12, 1, 3), R('bandH', 1, 40, 0.5, 6, '%'), R('jitter', 0, 200, 1, 24, 'px'), R('wobble', 0, 20, 0.1, 1.5, 'px'),
      R('bleed', 0, 30, 0.5, 5, 'px'), R('desat', 0, 1, 0.01, 0.25), R('noise', 0, 1, 0.01, 0.3), R('head', 0, 1, 0.01, 0.5), R('roll', 0, 4, 1, 1)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, k = ctx.k, n = W * H;
      const off = new Float32Array(H), band = new Float32Array(H);
      for (let y = 0; y < H; y++) off[y] = (rng() * 2 - 1) * p.wobble * k;
      for (let b = 0; b < 12; b++) {
        const r = [rng(), rng(), rng(), rng(), rng()];
        if (b >= p.bands) continue;
        const hgt = Math.max(2, p.bandH / 100 * H * (0.5 + r[1])), yc = frac(r[0] + p.roll * ctx.time) * (H + hgt) - hgt / 2;
        const amp = p.jitter * k * (0.4 + 0.6 * r[2]) * (r[3] < 0.5 ? -1 : 1);
        for (let y = Math.max(0, Math.floor(yc - hgt / 2)); y < Math.min(H, Math.ceil(yc + hgt / 2)); y++) {
          const t = (y - (yc - hgt / 2)) / hgt, prof = Math.sin(Math.PI * clamp(t, 0, 1));
          off[y] += amp * prof * (0.7 + 0.3 * Math.sin(r[4] * 6.283 + y * 0.35 / Math.max(k, 0.05)));
          band[y] = Math.max(band[y], prof);
        }
      }
      const reg = Math.round(H * 0.05 * p.head);
      for (let y = H - reg; y < H; y++) { const t = (y - (H - reg)) / Math.max(1, reg); off[y] += (t * t * 2 + rng() * 0.5) * (p.jitter + 20) * k; band[y] = Math.max(band[y], t * 0.9); }
      // shifted luma / chroma planes (YUV-like)
      const Yp = new Float32Array(n), U = new Float32Array(n), V = new Float32Array(n);
      for (let y = 0; y < H; y++) {
        const o = off[y], row = y * W;
        for (let x = 0; x < W; x++) {
          const sx = x + 0.5 - o, i = row + x;
          const r = bil(d, W, H, sx, y + 0.5, 0), g = bil(d, W, H, sx, y + 0.5, 1), b = bil(d, W, H, sx, y + 0.5, 2);
          const L = 0.299 * r + 0.587 * g + 0.114 * b;
          Yp[i] = L; U[i] = b - L; V[i] = r - L;
        }
      }
      // chroma bleed: horizontal box blur, delayed to the right
      const rad = Math.round(p.bleed * k);
      if (rad > 0) {
        const line = new Float32Array(W);
        for (const P of [U, V]) for (let y = 0; y < H; y++) {
          const row = y * W; let s = 0;
          for (let x = -rad; x <= rad; x++) s += P[row + clamp(x, 0, W - 1)];
          for (let x = 0; x < W; x++) {
            line[x] = s / (2 * rad + 1);
            s += P[row + clamp(x + rad + 1, 0, W - 1)] - P[row + clamp(x - rad, 0, W - 1)];
          }
          const shift = Math.round(rad / 2);
          for (let x = 0; x < W; x++) P[row + x] = line[clamp(x - shift, 0, W - 1)];
        }
      }
      const out = make(W, H), o = out.data, sat = 1 - p.desat, nz = p.noise;
      for (let y = 0; y < H; y++) {
        const bm = band[y], streak = bm > 0 && rng() < nz * bm * 0.6 ? 40 * nz * rng() : 0;
        for (let x = 0; x < W; x++) {
          const i = y * W + x, j = i * 4;
          let L = Yp[i] + (rng() - 0.5) * nz * 38 + streak;
          if (bm > 0 && rng() < nz * bm * 0.05) L += 90 + 120 * rng();
          const u = U[i] * sat, v = V[i] * sat, r = L + v, b = L + u;
          o[j] = r; o[j + 1] = (L - 0.299 * r - 0.114 * b) / 0.587; o[j + 2] = b; o[j + 3] = d[j + 3];
        }
      }
      return out;
    },
  };

  /* CRT: barrel curvature, scanlines that follow the curve, RGB aperture mask, vignette, brightness and flicker. */
  EFFECTS.crt = {
    params: [R('lines', 0, 1, 0.01, 0.5), R('spacing', 2, 16, 0.5, 4, 'px'), R('curve', 0, 1, 0.01, 0.3), R('mask', 0, 1, 0.01, 0.25),
      R('vignette', 0, 1, 0.01, 0.45), R('bright', 0.5, 2, 0.01, 1.15), R('flicker', 0, 1, 0.01, 0)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data;
      const P = Math.max(2, p.spacing * ctx.k), mp = Math.max(1, ctx.k * 1.5);
      const fl = 1 - p.flicker * 0.25 * (0.5 + 0.5 * Math.sin(ctx.time * Math.PI * 2 * 6)) - p.flicker * 0.1 * rng();
      const gain = p.bright * fl, curv = p.curve * 0.32;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const j = (y * W + x) * 4;
          let u = (x + 0.5) / W * 2 - 1, v = (y + 0.5) / H * 2 - 1;
          const r2 = u * u + v * v;
          u *= 1 + curv * r2; v *= 1 + curv * r2;
          if (u < -1 || u > 1 || v < -1 || v > 1) { o[j] = o[j + 1] = o[j + 2] = 0; o[j + 3] = 255; continue; }
          const sx = (u + 1) / 2 * W, sy = (v + 1) / 2 * H;
          let r = bil(d, W, H, sx, sy, 0), g = bil(d, W, H, sx, sy, 1), b = bil(d, W, H, sx, sy, 2);
          const lum = luma8(r, g, b) / 255;
          const scan = 1 - p.lines * 0.85 * (0.5 + 0.5 * Math.cos(2 * Math.PI * sy / P)) * (1 - 0.45 * lum);
          const ph = Math.floor(sx / mp) % 3, mk = 1 - p.mask * 0.55;
          const edge = Math.max(0, 1 - Math.pow(Math.max(Math.abs(u), Math.abs(v)), 6));
          const vig = (1 - p.vignette * clamp((u * u + v * v) / 2 * 1.3, 0, 1)) * (1 - p.vignette * (1 - edge));
          const m = scan * vig * gain;
          o[j] = r * m * (ph === 0 ? 1 : mk); o[j + 1] = g * m * (ph === 1 ? 1 : mk); o[j + 2] = b * m * (ph === 2 ? 1 : mk); o[j + 3] = 255;
        }
      }
      return out;
    },
  };

  /* Wave distortion: sine / square / saw / triangle displacement, optional per-channel phase split. */
  const WAVES = { sine: Math.sin, square: (t) => (Math.sin(t) >= 0 ? 1 : -1), saw: (t) => 2 * frac(t / (2 * Math.PI)) - 1,
    tri: (t) => 1 - 4 * Math.abs(frac(t / (2 * Math.PI) + 0.25) - 0.5) };
  EFFECTS.wave = {
    params: [S('axis', ['x', 'y', 'both'], 'x'), S('shape', Object.keys(WAVES), 'sine'), R('amp', 0, 300, 0.5, 20, 'px'), R('length', 4, 2000, 1, 160, 'px'),
      R('phase', 0, 360, 1, 0, '°'), R('speed', 0, 6, 1, 1), R('split', 0, 1, 0.01, 0), B('wrap', true)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data;
      const amp = p.amp * ctx.k, len = Math.max(2, p.length * ctx.k), fn = WAVES[p.shape] || Math.sin;
      const ph = p.phase * Math.PI / 180 + 2 * Math.PI * p.speed * ctx.time, ax = p.axis !== 'y', ay = p.axis !== 'x';
      const tabX = [new Float32Array(H), new Float32Array(H), new Float32Array(H)], tabY = [new Float32Array(W), new Float32Array(W), new Float32Array(W)];
      for (let c = 0; c < 3; c++) {
        const co = (c - 1) * p.split * Math.PI * 0.6;
        if (ax) for (let y = 0; y < H; y++) tabX[c][y] = amp * fn(2 * Math.PI * y / len + ph + co);
        if (ay) for (let x = 0; x < W; x++) tabY[c][x] = amp * fn(2 * Math.PI * x / len + ph * 1.13 + co);
      }
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const j = (y * W + x) * 4;
          for (let c = 0; c < 3; c++) {
            let sx = x - tabX[c][y], sy = y - tabY[c][x];
            if (p.wrap) { sx = wrap(sx, W); sy = wrap(sy, H); }
            o[j + c] = bil(d, W, H, sx + 0.5, sy + 0.5, c);
          }
          o[j + 3] = d[j + 3];
        }
      }
      return out;
    },
  };

  /* Pixelate / mosaic: averaged or centre-sampled cells, adjustable aspect, optional LED-style gaps. */
  EFFECTS.pixelate = {
    params: [R('size', 2, 300, 1, 14, 'px'), R('aspect', 0.25, 4, 0.05, 1), S('sample', ['avg', 'center'], 'avg'), R('gap', 0, 0.6, 0.01, 0)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data, sq = Math.sqrt(p.aspect);
      const cw = Math.max(1, Math.round(p.size * ctx.k * sq)), ch = Math.max(1, Math.round(p.size * ctx.k / sq));
      const gx = Math.floor(cw * (1 - p.gap)), gy = Math.floor(ch * (1 - p.gap));
      for (let y0 = 0; y0 < H; y0 += ch) {
        for (let x0 = 0; x0 < W; x0 += cw) {
          const x1 = Math.min(W, x0 + cw), y1 = Math.min(H, y0 + ch);
          let r = 0, g = 0, b = 0, a = 0, n = 0;
          if (p.sample === 'center') {
            const j = (Math.min(H - 1, (y0 + y1) >> 1) * W + Math.min(W - 1, (x0 + x1) >> 1)) * 4;
            r = d[j]; g = d[j + 1]; b = d[j + 2]; a = d[j + 3]; n = 1;
          } else {
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const j = (y * W + x) * 4; r += d[j]; g += d[j + 1]; b += d[j + 2]; a += d[j + 3]; n++; }
          }
          r /= n; g /= n; b /= n; a /= n;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const j = (y * W + x) * 4, dark = p.gap > 0 && cw > 2 && (x - x0 >= gx || y - y0 >= gy) ? 0.15 : 1;
            o[j] = r * dark; o[j + 1] = g * dark; o[j + 2] = b * dark; o[j + 3] = a;
          }
        }
      }
      return out;
    },
  };

  /* Posterize / bit-crush: N levels per channel, optional ordered (Bayer 4×4) dither and a XOR bit mask. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  EFFECTS.posterize = {
    params: [R('levels', 2, 64, 1, 6), B('dither', false), R('xor', 0, 255, 1, 0), R('bits', 0, 7, 1, 0)],
    run(img, p) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data, L = p.levels - 1;
      const mask = 255 << p.bits & 255;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4, t = p.dither ? (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5 : 0;
        for (let c = 0; c < 3; c++) {
          let v = Math.round(clamp(d[j + c] / 255 * L + t, 0, L)) / L * 255;
          v = ((v | 0) & mask) ^ p.xor;
          o[j + c] = v;
        }
        o[j + 3] = d[j + 3];
      }
      return out;
    },
  };

  /* Colour noise / grain: seeded additive noise (mono or per channel), grain size, random static lines. */
  EFFECTS.noise = {
    params: [R('amount', 0, 1, 0.01, 0.25), R('size', 1, 12, 1, 1, 'px'), B('mono', false), R('lines', 0, 1, 0.01, 0)],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data;
      const s = Math.max(1, Math.round(p.size * ctx.k)), A = p.amount * 160;
      const cols = Math.ceil(W / s), cells = new Float32Array(cols * 3);
      for (let y = 0; y < H; y++) {
        if (y % s === 0) for (let i = 0; i < cols; i++) {
          const m = rng() - 0.5, r1 = rng() - 0.5, r2 = rng() - 0.5;
          cells[i * 3] = (p.mono ? m : r1 * 0.7 + m * 0.3) * A; cells[i * 3 + 1] = m * A; cells[i * 3 + 2] = (p.mono ? m : r2 * 0.7 + m * 0.3) * A;
        }
        const ln = rng() < p.lines * 0.08 ? (rng() - 0.3) * 160 * p.lines : 0;
        for (let x = 0; x < W; x++) {
          const j = (y * W + x) * 4, c = ((x / s) | 0) * 3;
          o[j] = d[j] + cells[c] + ln; o[j + 1] = d[j + 1] + cells[c + 1] + ln; o[j + 2] = d[j + 2] + cells[c + 2] + ln; o[j + 3] = d[j + 3];
        }
      }
      return out;
    },
  };

  /* Mirror / kaleidoscope / tiles. */
  EFFECTS.mirror = {
    params: [S('mode', ['lr', 'rl', 'tb', 'bt', 'quad', 'kaleido', 'tile'], 'lr'), R('segments', 2, 24, 1, 6), R('rotate', 0, 360, 1, 0, '°'),
      R('cx', 0, 1, 0.01, 0.5), R('cy', 0, 1, 0.01, 0.5), R('tiles', 2, 10, 1, 3)],
    run(img, p) {
      const W = img.width, H = img.height, d = img.data, out = make(W, H), o = out.data;
      const ax = p.cx * W, ay = p.cy * H, m = p.mode;
      const seg = 2 * Math.PI / p.segments, rot = p.rotate * Math.PI / 180, tw = W / p.tiles, th = H / p.tiles;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4;
        let sx = x + 0.5, sy = y + 0.5;
        if ((m === 'lr' || m === 'quad') && sx > ax) sx = 2 * ax - sx;
        if (m === 'rl' && sx < ax) sx = 2 * ax - sx;
        if ((m === 'tb' || m === 'quad') && sy > ay) sy = 2 * ay - sy;
        if (m === 'bt' && sy < ay) sy = 2 * ay - sy;
        if (m === 'kaleido') {
          const vx = sx - ax, vy = sy - ay, r = Math.hypot(vx, vy);
          let a = wrap(Math.atan2(vy, vx) - rot, 2 * Math.PI) % seg;
          if (a > seg / 2) a = seg - a;
          sx = ax + r * Math.cos(a + rot); sy = ay + r * Math.sin(a + rot);
          // reflect back inside the frame
          sx = W - Math.abs(W - Math.abs(wrap(sx, 2 * W))); sy = H - Math.abs(H - Math.abs(wrap(sy, 2 * H)));
        }
        if (m === 'tile') {
          const cx = Math.floor(sx / tw), cy = Math.floor(sy / th);
          let fx = (sx - cx * tw) / tw, fy = (sy - cy * th) / th;
          if (cx & 1) fx = 1 - fx;
          if (cy & 1) fy = 1 - fy;
          sx = fx * W; sy = fy * H;
        }
        for (let c = 0; c < 3; c++) o[j + c] = bil(d, W, H, sx, sy, c);
        o[j + 3] = 255;
      }
      return out;
    },
  };

  /* Melt / pixel drip: columns whose start pixel is bright enough are smeared down (or up). */
  EFFECTS.melt = {
    params: [R('amount', 0, 1, 0.01, 0.35), R('density', 0, 1, 0.01, 0.5), R('width', 1, 80, 1, 6, 'px'), R('threshold', 0, 1, 0.01, 0.2),
      R('stretch', 0, 1, 0.01, 0.12), S('dir', ['down', 'up'], 'down')],
    run(img, p, rng, ctx) {
      const W = img.width, H = img.height, d = img.data, out = clone(img), o = out.data;
      const cw = Math.max(1, Math.round(p.width * ctx.k)), up = p.dir === 'up';
      for (let x0 = 0; x0 < W; x0 += cw) {
        const r1 = rng(), r2 = rng(), r3 = rng();
        if (r1 > p.density) continue;
        const L = Math.max(2, Math.round(p.amount * H * (0.2 + 0.8 * r2))), y0 = Math.floor(r3 * H);
        const j0 = (y0 * W + Math.min(W - 1, x0)) * 4;
        if (luma8(d[j0], d[j0 + 1], d[j0 + 2]) / 255 < p.threshold) continue;
        for (let x = x0; x < Math.min(W, x0 + cw); x++) {
          for (let t = 0; t < L; t++) {
            const y = up ? y0 - t : y0 + t;
            if (y < 0 || y >= H) break;
            const sy = clamp(Math.round(up ? y0 - t * p.stretch : y0 + t * p.stretch), 0, H - 1);
            const f = t / L > 0.85 ? (t / L - 0.85) / 0.15 : 0, j = (y * W + x) * 4, s = (sy * W + x) * 4;
            for (let c = 0; c < 3; c++) o[j + c] = d[s + c] + (d[j + c] - d[s + c]) * f;
          }
        }
      }
      return out;
    },
  };

  const TYPES = Object.keys(EFFECTS);
  const BLENDS = ['normal', 'screen', 'multiply', 'difference', 'add', 'lighten', 'darken', 'overlay'];
  const BLEND_FN = {
    normal: (b, f) => f, screen: (b, f) => 255 - (255 - b) * (255 - f) / 255, multiply: (b, f) => b * f / 255,
    difference: (b, f) => Math.abs(b - f), add: (b, f) => b + f, lighten: (b, f) => (b > f ? b : f), darken: (b, f) => (b < f ? b : f),
    overlay: (b, f) => (b < 128 ? 2 * b * f / 255 : 255 - 2 * (255 - b) * (255 - f) / 255),
  };
  /** Mix the effect output fx over base with the layer's blend mode and amount (writes into fx). */
  function blendInto(base, fx, mix, mode) {
    if (fx.width !== base.width || fx.height !== base.height) return base;
    const b = base.data, f = fx.data, fn = BLEND_FN[mode] || BLEND_FN.normal;
    if (mix >= 1 && fn === BLEND_FN.normal) return fx;
    for (let i = 0; i < b.length; i += 4) {
      for (let c = 0; c < 3; c++) { const bv = b[i + c]; f[i + c] = bv + (fn(bv, f[i + c]) - bv) * mix; }
      f[i + 3] = b[i + 3];
    }
    return fx;
  }

  /* ------------------------------------------------------------------ layers & settings */
  function defaults(type) { const o = {}; for (const s of EFFECTS[type].params) o[s.key] = s.def; return o; }
  /** Fill missing parameters with defaults and clamp / validate every value against the schema. */
  function normParams(type, params) {
    const o = {}, src = params || {};
    for (const s of EFFECTS[type].params) {
      let v = src[s.key];
      if (s.type === 'range') { v = Number(v); o[s.key] = Number.isFinite(v) ? clamp(v, s.min, s.max) : s.def; }
      else if (s.type === 'select') o[s.key] = s.options.includes(v) ? v : s.def;
      else o[s.key] = typeof v === 'boolean' ? v : v === 1 || v === '1' ? true : v === 0 || v === '0' ? false : s.def;
    }
    return o;
  }
  let uid = 0;
  /** Create a layer (fresh salt so its randomness is independent of its position in the stack). */
  function makeLayer(type, params, extra) {
    if (!EFFECTS[type]) throw new Error('unknown effect ' + type);
    const e = extra || {};
    return { id: 'L' + Date.now().toString(36) + (uid++).toString(36), type, on: e.on !== false, mix: clamp(Number(e.mix != null ? e.mix : 1) || 0, 0, 1),
      blend: BLENDS.includes(e.blend) ? e.blend : 'normal', salt: e.salt != null ? e.salt >>> 0 : Math.floor(Math.random() * 1e9), params: normParams(type, params) };
  }

  /** Run the whole stack on src. opts: { seed, k, time, tick, onStep(i, n) }. Never mutates src. */
  async function render(src, stack, opts) {
    const o = opts || {}, ctx = { k: o.k || 1, time: o.time || 0, tick: o.tick || 0 };
    let cur = src;
    const live = (stack || []).filter((L) => L && L.on && EFFECTS[L.type] && L.mix > 0);
    for (let i = 0; i < live.length; i++) {
      const L = live[i], p = normParams(L.type, L.params);
      const rng = rng32(hashInts(o.seed | 0, L.salt | 0, ctx.tick | 0));
      let out = EFFECTS[L.type].run(cur, p, rng, ctx);
      if (out && typeof out.then === 'function') out = await out;
      cur = blendInto(cur, out, L.mix, L.blend);
      if (o.onStep) o.onStep(i + 1, live.length);
    }
    return cur === src ? clone(src) : cur;
  }

  /** Settings object for JSON export / URL sharing (no image data). */
  function serialize(state) {
    return { app: 'glitch-atelier', version: 1, seed: state.seed >>> 0,
      stack: state.stack.map((L) => ({ type: L.type, on: !!L.on, mix: +(+L.mix).toFixed(3), blend: L.blend, salt: L.salt >>> 0, params: normParams(L.type, L.params) })) };
  }
  /** Validate settings from JSON / URL; unknown effects are dropped, values clamped. Throws on garbage. */
  function deserialize(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.stack)) throw new Error('invalid settings');
    const seed = Number.isFinite(Number(obj.seed)) ? Number(obj.seed) >>> 0 : 1;
    const stack = obj.stack.filter((L) => L && EFFECTS[L.type]).slice(0, 40).map((L) => makeLayer(L.type, L.params, L));
    return { seed, stack };
  }
  // URL hash: compact form [seed, [[type, on, mix, blend, salt, {non-default params}], …]] in base64url.
  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  function toHash(state) {
    const st = serialize(state);
    const compact = [st.seed, st.stack.map((L) => {
      const def = defaults(L.type), diff = {};
      for (const k in L.params) if (L.params[k] !== def[k]) diff[k] = L.params[k];
      return [L.type, L.on ? 1 : 0, L.mix, L.blend, L.salt, diff];
    })];
    return 'g=' + b64e(JSON.stringify(compact));
  }
  function fromHash(hash) {
    const m = /(?:^|[#&])g=([A-Za-z0-9_-]+)/.exec(hash || '');
    if (!m) return null;
    const c = JSON.parse(b64d(m[1]));
    if (!Array.isArray(c) || !Array.isArray(c[1])) throw new Error('invalid hash');
    return deserialize({ seed: c[0], stack: c[1].map((a) => ({ type: a[0], on: !!a[1], mix: a[2], blend: a[3], salt: a[4], params: a[5] })) });
  }

  return { EFFECTS, TYPES, BLENDS, rng32, hashInts, make, clone, defaults, normParams, makeLayer, render, blendInto,
    serialize, deserialize, toHash, fromHash, jpegSim };
});
