/* worker.js — Glitch Atelier render worker: runs the effect stack off the main thread so the UI stays responsive.
 * Message in: { id, width, height, buffer (transferred), stack, opts }  →  out: { id, ok, width, height, buffer } */
importScripts('effects.js');
self.onmessage = async (e) => {
  const m = e.data;
  try {
    const src = { width: m.width, height: m.height, data: new Uint8ClampedArray(m.buffer) };
    const out = await Glitch.render(src, m.stack, Object.assign({}, m.opts, {
      onStep: (i, n) => self.postMessage({ id: m.id, progress: i / n }),
    }));
    const data = out.data.byteOffset === 0 && out.data.byteLength === out.data.buffer.byteLength ? out.data : new Uint8ClampedArray(out.data);
    self.postMessage({ id: m.id, ok: true, width: out.width, height: out.height, buffer: data.buffer }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
