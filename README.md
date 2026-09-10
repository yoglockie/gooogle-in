# Trick 02 — Search Peek

A spectator searches "Google". The term lands in your app, newest first. You
"divine" it. Inspired by Google Peek / Goo.

**One search page, one shared feed, no room codes.** Every search the page sends
shows up in the magician's app, latest at the top.

## Architecture

```
SPECTATOR PAGE (Vercel)          API (Vercel functions)            MAGICIAN APP
  gooo-ish.vercel.app              holds MONGODB_URI server-side
  types a search                            │
  ── POST /api/q ───────────────▶  insert ─┼─▶  MongoDB Atlas
  ── redirect ─▶ real google.com            │        │
                                   GET /api/searches ◀┘ ◀─ polled 1.5s ─▶ latest first
```

- **The DB credential never leaves the server.** The spectator page and the app
  only ever call `/api/*`. The Atlas connection string lives in a Vercel env var
  that is never sent to any browser or baked into the APK. A page/app that talked
  to Atlas directly would leak full database access to every spectator — and
  browsers can't open Mongo's TCP sockets anyway.
- **Serverless-friendly.** Vercel functions keep no memory between calls, so the
  feed lives in Atlas. The app **polls** every 1.5s instead of holding a socket —
  simpler, survives sleep/network drops, identical in a browser and the APK.
- **Searches self-delete.** A TTL index drops them after `TTL_HOURS` (default 6).
  You are storing real people's searches briefly; don't keep them forever.

## Run locally

**In-memory (no database, zero setup):**

```bash
node server.js      # http://localhost:8787
node test.js        # 9 checks: ordering, dedupe ids, cap, blank reject, GET fallback
```

**Against your real Atlas (rehearse the production path):**

```bash
cp .env.example .env      # then paste your Atlas URI into .env  (never commit it)
npm run start:atlas       # = node --env-file=.env server.js
```

Either way:

- Spectator: http://localhost:8787/
- Magician (browser preview of the app): http://localhost:8787/notes

Search on the spectator tab → it appears on the peek tab within ~1.5s, newest at
top, then the spectator tab forwards to real Google. With `start:atlas`, the term
is really written to and read from your Atlas cluster.

## Files

```
index.html + spectator.js   the Google clone (served at /)
notes.html                   hidden web peek, self-contained, served at /notes
server.js                    LOCAL dev server, in-memory, zero deps
api/_store.js                MongoDB Atlas (driver, server-side only)
api/q.js                     POST /api/q     save a search
api/searches.js              GET  /api/searches   poll, newest first
vercel.json                  builds + routes (static pages + functions + /notes)
test.js                      end-to-end API checks
```

The performer's main view is the separate APK in `../02-search-peek-app/`.
`/notes` is a hidden web fallback on the site itself — not linked anywhere.

## Deploy the spectator page + API to Vercel

1. **Push this folder to a Git repo** and import it at vercel.com (New Project).
   No framework preset — Vercel serves the static files and runs `api/*` as
   functions automatically, installing `mongodb` from package.json.
2. **Set the env var.** Vercel → Project → Settings → Environment Variables:
   - `MONGODB_URI` = your Atlas string (optionally `MONGODB_DB`, `TTL_HOURS`).
   Paste it here only — it stays server-side and is never shipped to the client.
3. **Open Atlas to Vercel.** Atlas → Network Access → add `0.0.0.0/0`
   (allow from anywhere). Vercel's function IPs are dynamic, so a narrower
   allowlist will make the API fail to connect. The URI's password is still
   required, so this is normal for serverless + Atlas.
4. **Deploy.** Then:
   - spectator page → `https://<your-project>.vercel.app/`
   - poll endpoint → `https://<your-project>.vercel.app/api/searches`

Check it: open the page, search once, then visit `/api/searches` — your term is
there, and it appears in your Atlas `searchpeek.searches` collection.

### Two Atlas gotchas (both fail silently)

- **Network Access** not opened to `0.0.0.0/0` → functions time out connecting.
- **Wrong URI / password** or missing `MONGODB_URI` → `/api/searches` returns
  `configured:false` or a 500. The peek page shows "connected · store not set".

### About the name

`google.vercel.app` is taken, and a public page branded exactly "Google" can be
pulled for trademark. A plausible near-name (`gooogle-in.vercel.app`) or a cheap
custom domain both fool a tech-savvy spectator better than the obvious one. Your
call — it's your deploy.

## The magician app

For now, `notes.html` in a browser IS the magician view — point it at your deploy
with the **Set** box (paste `https://<your-project>.vercel.app`), and it polls
there. The APK is the next step: wrap this same page with Capacitor (like Trick
1) so it lives as a "Notes" app on your phone with the URL baked in.

## The honest boundary

They search on **your** page (you open the link / hand them the device), never on
their real untouched Google. That is a performance prop — the same status as the
Notepad clone in Trick 1. It does not read anything off their real phone.

## Status

Deployed and working end to end at `https://gooogle-co.vercel.app` (MongoDB
Atlas). Hidden web peek at `/notes`. The magician APK lives in
`../02-search-peek-app/`. 9/9 local tests pass.
