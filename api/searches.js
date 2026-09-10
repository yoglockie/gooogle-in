/* GET /api/searches?limit=50  - the magician app polls this, newest first. */
'use strict';
const store = require('./_store.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!store.configured()) {
    res.status(200).json({ now: Date.now(), configured: false, searches: [] });
    return;
  }
  try {
    const limit = Math.min(200, parseInt((req.query && req.query.limit) || '50', 10) || 50);
    const searches = await store.list(limit);
    res.status(200).json({ now: Date.now(), configured: true, searches });
  } catch (e) {
    res.status(500).json({ now: Date.now(), error: String(e.message || e), searches: [] });
  }
};
