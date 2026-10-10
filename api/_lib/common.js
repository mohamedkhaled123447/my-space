// Shared helpers for the Vercel functions: auth cookie, JSON responses and Upstash Redis access.
// Files under api/_lib are not deployed as endpoints.
const crypto = require("crypto");

const COOKIE = "myspace_auth";
const KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const HASH = "myspace:state";

function secret() { return process.env.APP_SECRET || ""; }

// The cookie holds an HMAC of the secret, so the secret itself never leaves the server.
// Changing APP_SECRET logs every browser out.
function authToken() { return crypto.createHmac("sha256", secret()).update("my-space-auth-v1").digest("hex"); }

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

function isAuthed(req) { return !!secret() && safeEqual(readCookie(req, COOKIE), authToken()); }

function authCookie(maxAge) {
  return COOKIE + "=" + (maxAge ? authToken() : "") + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// Vercel parses JSON bodies into req.body; fall back to reading the stream when it hasn't.
async function readJson(req) {
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  return typeof body === "string" ? JSON.parse(body) : body;
}

// Upstash Redis REST API. Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
async function redis(...command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw Object.assign(new Error("Redis is not configured"), { config: true });
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error("Redis error: " + (data.error || "HTTP " + r.status));
  return data.result;
}

module.exports = { KEY_RE, HASH, secret, safeEqual, isAuthed, authCookie, send, readJson, redis };
