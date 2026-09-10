# Deploying Search Peek to Vercel

You deploy **this folder** (`02-search-peek/`). It contains the spectator page
and the `api/` functions that talk to your Atlas. Nothing else to host.

`.env`, `node_modules`, `server.js`, `test.js` are excluded (`.vercelignore`) —
they're for local dev only.

---

## Fastest path — Vercel CLI (no Git repo needed)

Run these in your terminal, in `magic-lab/02-search-peek`:

```bash
npm i -g vercel          # install the CLI (once)
vercel login             # opens a browser to log in / sign up (free)
vercel                   # first deploy - answer the prompts (see below)
```

Prompts on first `vercel`:
- *Set up and deploy?* → **Y**
- *Which scope?* → your account
- *Link to existing project?* → **N**
- *Project name?* → pick your subdomain, e.g. `gooogle-in` → `gooogle-in.vercel.app`
- *Directory?* → **`./`** (just press Enter)
- *Override settings?* → **N**

That gives you a **preview URL**. The API won't work yet — it has no database
credential. Two more steps:

### 1. Give it your Atlas string

```bash
vercel env add MONGODB_URI production
# paste your mongodb+srv string when asked (with the real password)
```
(Optional: `vercel env add MONGODB_DB production` → `searchpeek`, and
`vercel env add TTL_HOURS production` → `6`.)

### 2. Open Atlas to Vercel

Atlas → **Network Access** → Add IP Address → **Allow access from anywhere**
(`0.0.0.0/0`). Vercel's function IPs are dynamic, so a specific IP won't work.
The password still guards the database.

### Then ship to production

```bash
vercel --prod
```

You get your real URL: `https://<project>.vercel.app`
- Spectator page → `https://<project>.vercel.app/`
- App polls      → `https://<project>.vercel.app/api/searches`

---

## Alternative — Git + Vercel dashboard

1. Push this folder to a GitHub repo.
2. vercel.com → **Add New → Project** → import the repo.
3. Framework preset: **Other**. Root directory: this folder.
4. Add env var `MONGODB_URI` (Settings → Environment Variables).
5. Atlas → Network Access → `0.0.0.0/0`.
6. Deploy.

---

## Verify the deploy

1. Open `https://<project>.vercel.app/` — the Google page.
2. Search something.
3. Open `https://<project>.vercel.app/api/searches` — your term is in the JSON.
4. Atlas → Browse Collections → `searchpeek.searches` — it's a document there.

If `/api/searches` shows `configured:false` → env var not set (or you didn't
redeploy after adding it). If it 500s or times out → Atlas Network Access.

---

## After deploy

- **Spectator device**: opens `https://<project>.vercel.app/` — works from any
  network now, no shared WiFi.
- **Your peek**: open `https://<project>.vercel.app/peek.html` in a browser, or
  build the APK pointed at this URL.
- **Rotate the DB password** if it was ever shared, and update it with
  `vercel env rm MONGODB_URI production` then `vercel env add` again, and
  `vercel --prod`.
