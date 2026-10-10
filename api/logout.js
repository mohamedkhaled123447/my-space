// POST -> clears the auth cookie.
const { authCookie, send } = require("./_lib/common");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  res.setHeader("Set-Cookie", authCookie(0));
  return send(res, 200, { ok: true });
};
