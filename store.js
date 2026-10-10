// Client for the JSON server (server.js). Each page keeps its state under one key at /api/state/<key>.
// Store.load(key) resolves to the saved value or null; Store.save(key, value) writes it after a short pause.
(function () {
  const BASE = "/api/state/";
  const pending = {}, timers = {}, chains = {};
  let listener = null, failing = false;

  function status(s) { if (listener) listener(s); }
  function url(key) { return BASE + encodeURIComponent(key); }

  async function load(key) {
    const r = await fetch(url(key), { cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("Load failed: HTTP " + r.status);
    return r.json();
  }

  // Writes for the same key run one after another, so an older value can never land after a newer one.
  function flush(key, keepalive) {
    clearTimeout(timers[key]);
    if (!(key in pending)) return chains[key] || Promise.resolve();
    chains[key] = (chains[key] || Promise.resolve()).then(async () => {
      if (!(key in pending)) return;
      const body = pending[key];
      delete pending[key];
      try {
        const r = await fetch(url(key), { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: !!keepalive });
        if (!r.ok) throw new Error("HTTP " + r.status);
        failing = false;
        if (!Object.keys(pending).length) status("saved");
      } catch (e) {
        if (!(key in pending)) pending[key] = body;
        failing = true;
        status("error");
        timers[key] = setTimeout(() => flush(key), 3000);
      }
    });
    return chains[key];
  }

  function save(key, value, delay) {
    pending[key] = JSON.stringify(value);
    clearTimeout(timers[key]);
    if (!failing) status("saving");
    timers[key] = setTimeout(() => flush(key), delay == null ? 300 : delay);
  }

  addEventListener("pagehide", () => { Object.keys(pending).forEach((k) => flush(k, true)); });

  window.Store = { load, save, flush, onStatus(fn) { listener = fn; } };
})();
