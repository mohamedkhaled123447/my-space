// Same API as server.js, backed by Upstash Redis (one hash, one field per key):
//   GET /api/state, GET|PUT|DELETE /api/state/:key  (vercel.json rewrites /api/state/:key here)
const { KEY_RE, HASH, secret, isAuthed, send, readJson, redis } = require("./_lib/common");

function keyOf(req) {
  if (req.query && typeof req.query.key === "string") return req.query.key;
  const url = new URL(req.url, "http://localhost");
  if (url.searchParams.has("key")) return url.searchParams.get("key");
  const m = url.pathname.match(/^\/api\/state\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : "";
}

module.exports = async (req, res) => {
  if (!secret()) return send(res, 500, { error: "APP_SECRET is not set" });
  if (!isAuthed(req)) return send(res, 401, { error: "Login required" });

  try {
    const key = keyOf(req);
    if (key === "") {
      if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
      const flat = (await redis("HGETALL", HASH)) || [];
      const all = {};
      for (let i = 0; i < flat.length; i += 2) all[flat[i]] = JSON.parse(flat[i + 1]);
      return send(res, 200, all);
    }
    if (!KEY_RE.test(key)) return send(res, 400, { error: "Invalid key" });

    if (req.method === "GET") {
      const v = await redis("HGET", HASH, key);
      return v == null ? send(res, 404, { error: "Not found" }) : send(res, 200, JSON.parse(v));
    }
    if (req.method === "PUT") {
      let value;
      try { value = await readJson(req); } catch (e) { return send(res, 400, { error: "Body must be JSON" }); }
      if (value === undefined) return send(res, 400, { error: "Body must be JSON" });
      await redis("HSET", HASH, key, JSON.stringify(value));
      return send(res, 200, { ok: true });
    }
    if (req.method === "DELETE") {
      await redis("HDEL", HASH, key);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.config ? e.message : "Server error" });
  }
};
