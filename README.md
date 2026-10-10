# My Space

A dashboard (`index.html`) with a sidebar linking to Daily Planner, Hifz Mushaf, Worklist, Recall Deck and the Backend Roadmap Tracker.

## Running

```sh
npm start        # or: node server.js
```

Then open http://localhost:3000. No dependencies are needed beyond Node 18+. Locally there is no password.

`server.js` serves the pages and keeps their state in `db.json` (created on first save, not committed).
Set `PORT` or `DB_FILE` to change the port or the data file.

## Deploying to Vercel

On Vercel the pages are served as static files and `api/` holds the functions; `server.js` is not used there.
State is kept in Upstash Redis and everything is behind a password.

1. On vercel.com: **Add New → Project**, import this repo. Framework Preset **Other**, no build command, output directory = project root.
2. In the project: **Storage → Create Database → Upstash (Redis)**, and connect it to the project.
   This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work).
3. **Settings → Environment Variables**: add `APP_SECRET`, a long password you'll sign in with.
4. Redeploy so the variables apply. Opening the site sends you to `login.html`; signing in sets a cookie that lasts a year.
   Changing `APP_SECRET` signs every browser out. `POST /api/logout` signs the current browser out.

To move local data over, sign in on the deployed site, then for each key in your local `db.json` run in the browser console:
`fetch("/api/state/<key>", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(<value>) })`.

## API

| Method | Path              | Does                                   |
|--------|-------------------|----------------------------------------|
| GET    | `/api/state`      | Returns every stored key               |
| GET    | `/api/state/:key` | Returns one key (404 if not saved yet) |
| PUT    | `/api/state/:key` | Replaces a key with the JSON body      |
| DELETE | `/api/state/:key` | Removes a key                          |

Keys used by the pages: `planner`, `worklist`, `recall`, `roadmap`, `mushaf`, `dashboard`.
