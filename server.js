/* ============================================================
   Magic Lab / Trick 02 - Search Peek
   LOCAL DEV server. Zero dependencies, in-memory feed.

   Mirrors the Vercel API exactly so the pages and the app behave the same
   locally as in production:
     POST /api/q            spectator delivers a captured term
     GET  /api/searches     magician app polls; newest first
   plus it serves the static pages.

   Production uses the Vercel functions in api/ backed by Redis; this file is
   only for building and rehearsing on your machine.

   Run:  node server.js        (http://localhost:8787)
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const CAP = 200;

/* Store selection:
   - MONGODB_URI set  -> use the real Atlas store (api/_store.js), so you can
     rehearse the exact production path from your laptop.
   - otherwise        -> in-memory feed, zero setup.
   Run against Atlas with:  node --env-file=.env server.js   (Node 20+)        */
let mongo = null;
if (process.env.MONGODB_URI) {
  try { mongo = require('./api/_store.js'); console.log('store: MongoDB Atlas'); }
  catch (e) { console.error('MONGODB_URI is set but the mongodb driver failed to load. Run: npm install\n', e.message); process.exit(1); }
} else {
  console.log('store: in-memory (set MONGODB_URI to use Atlas)');
}

/* in-memory fallback feed, newest first */
let feed = [];
let seq = 0;

async function addTerm(term) {
  term = String(term || '').trim().slice(0, 300);
  if (!term) return null;
  if (mongo) { const it = await mongo.push(term); console.log(`[q] ${JSON.stringify(it.term)} -> atlas`); return it; }
  const item = { id: Date.now() + '-' + (++seq), term, at: Date.now() };
  feed.unshift(item);
  if (feed.length > CAP) feed.length = CAP;
  console.log(`[q] ${JSON.stringify(term)}  (feed=${feed.length})`);
  return item;
}
async function listTerms(limit) {
  if (mongo) return mongo.list(limit);
  return feed.slice(0, limit);
}
async function clearTerms() {
  if (mongo) return mongo.clear();
  feed = [];
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8' };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  /* ---- magician app polls here ---- */
  if (url.pathname === '/api/searches') {
    const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10) || 50);
    listTerms(limit)
      .then(s => json(res, 200, { now: Date.now(), configured: true, searches: s }))
      .catch(e => json(res, 500, { now: Date.now(), error: String(e.message || e), searches: [] }));
    return;
  }

  /* ---- spectator delivers a term ---- */
  if (url.pathname === '/api/q') {
    if (req.method === 'GET') {
      addTerm(url.searchParams.get('term'))
        .then(item => json(res, item ? 200 : 400, item ? { ok: true, id: item.id } : { ok: false }))
        .catch(e => json(res, 500, { ok: false, error: String(e.message || e) }));
      return;
    }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4000) req.destroy(); });
    req.on('end', () => {
      let term = body;
      try { term = JSON.parse(body).term ?? body; } catch (e) {}
      addTerm(term)
        .then(item => json(res, item ? 200 : 400, item ? { ok: true, id: item.id } : { ok: false, error: 'empty' }))
        .catch(e => json(res, 500, { ok: false, error: String(e.message || e) }));
    });
    return;
  }

  if (url.pathname === '/api/clear') {
    clearTerms().then(() => json(res, 200, { ok: true })).catch(e => json(res, 500, { ok: false, error: String(e.message || e) }));
    return;
  }
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }

  /* ---- static files ---- */
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(ROOT, path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Search Peek (local) on http://localhost:' + PORT);
  console.log('  spectator : http://localhost:' + PORT + '/');
  console.log('  peek test : http://localhost:' + PORT + '/peek.html');
});
