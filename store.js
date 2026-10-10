// Client for the state API (server.js locally, api/state.js on Vercel). Each page keeps its state under one key at /api/state/<key>.
// Store.load(key) resolves to the saved value or null; Store.save(key, value) writes it after a short pause.
// When the API answers 401 (Vercel deployment without a login), the whole window goes to login.html.
(function () {
  const BASE = "/api/state/";
  const pending = {}, timers = {}, chains = {};
  let listener = null, failing = false;

  function status(s) { if (listener) listener(s); }
  function url(key) { return BASE + encodeURIComponent(key); }

  function toLogin() {
    let w = window;
    try { if (window.top.location.origin === location.origin) w = window.top; } catch (e) { /* cross-origin parent */ }
    const here = w.location.pathname + w.location.search + w.location.hash;
    if (!/\/login\.html$/.test(w.location.pathname)) w.location.href = "/login.html?next=" + encodeURIComponent(here);
    return new Error("Login required");
  }

  async function get(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (r.status === 401) throw toLogin();
    return r;
  }

  async function loadAll() {
    const r = await get("/api/state");
    if (!r.ok) throw new Error("Load failed: HTTP " + r.status);
    return r.json();
  }

  async function load(key) {
    const r = await get(url(key));
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
        if (r.status === 401) { pending[key] = pending[key] || body; toLogin(); return; }
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

  window.Store = { load, loadAll, save, flush, onStatus(fn) { listener = fn; } };
})();
