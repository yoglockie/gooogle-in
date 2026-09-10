/* POST /api/q  - the spectator page delivers the term it captured.
   Accepts JSON {term} or a raw text body (navigator.sendBeacon sends text). */
'use strict';
const store = require('./_store.js');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  let term = '';
  try {
    if (req.method === 'GET') {
      term = (req.query && req.query.term) || '';
    } else if (typeof req.body === 'string') {
      try { term = JSON.parse(req.body).term; } catch (e) { term = req.body; }
    } else if (req.body && typeof req.body === 'object') {
      term = req.body.term || '';
    } else {
      // body not pre-parsed: read the stream
      term = await new Promise(resolve => {
        let b = ''; req.on('data', c => { b += c; if (b.length > 4000) req.destroy(); });
        req.on('end', () => { try { resolve(JSON.parse(b).term); } catch (e) { resolve(b); } });
      });
    }
  } catch (e) { term = ''; }

  term = String(term || '').trim();
  if (!term) { res.status(400).json({ ok: false, error: 'empty term' }); return; }

  if (!store.configured()) {
    res.status(500).json({ ok: false, error: 'Database not configured. Set MONGODB_URI.' });
    return;
  }
  try {
    const item = await store.push(term);
    res.status(200).json({ ok: true, id: item.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
