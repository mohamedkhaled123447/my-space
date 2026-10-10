// Small JSON server: serves the pages in this folder and stores their state in db.json.
//   GET    /api/state        -> every stored key
//   GET    /api/state/:key   -> one key (404 when not set yet)
//   PUT    /api/state/:key   -> replace a key with the JSON body
//   DELETE /api/state/:key   -> remove a key
// Run with `node server.js` (PORT and DB_FILE can be overridden by env vars).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_FILE = path.resolve(process.env.DB_FILE || path.join(ROOT, "db.json"));
const MAX_BODY = 10 * 1024 * 1024;
const KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const HIDDEN = new Set(["server.js", "package.json", "package-lock.json", path.basename(DB_FILE)]);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".woff2": "font/woff2",
};

let db = {};
try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) || {}; } catch (e) {
  if (e.code !== "ENOENT") { console.error("Could not read " + DB_FILE + ": " + e.message); process.exit(1); }
}

// Writes are queued and go through a temp file so db.json is never left half-written.
let writeQueue = Promise.resolve();
function persist() {
  const data = JSON.stringify(db, null, 2);
  writeQueue = writeQueue.then(async () => {
    await fs.promises.writeFile(DB_FILE + ".tmp", data);
    await fs.promises.rename(DB_FILE + ".tmp", DB_FILE);
  });
  return writeQueue;
}

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(type ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Body too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function api(req, res, key) {
  if (key === "") {
    if (req.method === "GET") return send(res, 200, db);
    return send(res, 405, { error: "Method not allowed" });
  }
  if (!KEY_RE.test(key)) return send(res, 400, { error: "Invalid key" });
  const has = Object.prototype.hasOwnProperty.call(db, key);

  if (req.method === "GET") return has ? send(res, 200, db[key]) : send(res, 404, { error: "Not found" });
  if (req.method === "PUT") {
    let value;
    try { value = JSON.parse(await readBody(req)); } catch (e) {
      return send(res, e.status || 400, { error: e.status ? e.message : "Body must be JSON" });
    }
    db[key] = value;
    await persist();
    return send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") {
    if (has) { delete db[key]; await persist(); }
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "Method not allowed" });
}

function serveFile(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed" });
  let rel;
  try { rel = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html"; } catch (e) { return send(res, 400, { error: "Bad path" }); }
  const file = path.resolve(ROOT, rel);
  const name = path.relative(ROOT, file);
  if (name.startsWith("..") || path.isAbsolute(name) || name.split(path.sep).some((p) => p.startsWith(".")) || HIDDEN.has(name) || name.startsWith("node_modules")) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    const m = pathname.match(/^\/api\/state\/?(.*)$/);
    if (m) return await api(req, res, m[1]);
    serveFile(req, res, pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "Server error" });
  }
}).listen(PORT, () => {
  console.log("My Space running at http://localhost:" + PORT + " (data in " + DB_FILE + ")");
});
