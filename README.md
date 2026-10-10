# My Space

A dashboard (`index.html`) with a sidebar linking to Hifz Mushaf, Worklist, Recall Deck and the Backend Roadmap Tracker.

## Running

```sh
npm start        # or: node server.js
```

Then open http://localhost:3000. No dependencies are needed beyond Node 18+.

`server.js` serves the pages and keeps their state in `db.json` (created on first save, not committed).
Set `PORT` or `DB_FILE` to change the port or the data file.

## API

| Method | Path              | Does                                   |
|--------|-------------------|----------------------------------------|
| GET    | `/api/state`      | Returns every stored key               |
| GET    | `/api/state/:key` | Returns one key (404 if not saved yet) |
| PUT    | `/api/state/:key` | Replaces a key with the JSON body      |
| DELETE | `/api/state/:key` | Removes a key                          |

Keys used by the pages: `worklist`, `recall`, `roadmap`, `mushaf`, `dashboard`.
