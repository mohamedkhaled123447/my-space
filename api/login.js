// POST { password } -> sets the auth cookie when it matches APP_SECRET.
const { secret, safeEqual, authCookie, send, readJson } = require("./_lib/common");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!secret()) return send(res, 500, { error: "APP_SECRET is not set" });
  let body;
  try { body = await readJson(req); } catch (e) { return send(res, 400, { error: "Body must be JSON" }); }
  if (!body || !safeEqual(body.password || "", secret())) {
    await new Promise((r) => setTimeout(r, 500)); // slow down guessing
    return send(res, 401, { error: "Wrong password" });
  }
  res.setHeader("Set-Cookie", authCookie(60 * 60 * 24 * 365));
  return send(res, 200, { ok: true });
};
