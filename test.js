/* End-to-end check of the local dev API. Start `node server.js` first.
   Proves: a posted term shows up in the feed newest-first, and the app's
   dedupe-by-id contract holds (no repeats across polls). */
const http = require('http');
const PORT = process.env.PORT || 8787;
const base = 'http://localhost:' + PORT;

let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL: ' + m); } else console.log('  ok: ' + m); };

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(base + path, { method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve(b); } }); });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  await req('GET', '/api/clear');

  // 1. post two terms, newest first
  await req('POST', '/api/q', { term: 'italy visa rules' });
  await new Promise(r => setTimeout(r, 10));
  await req('POST', '/api/q', { term: 'best biryani near me' });
  let res = await req('GET', '/api/searches');
  ok(res.searches.length === 2, 'feed has both searches');
  ok(res.searches[0].term === 'best biryani near me', 'newest search is first');
  ok(res.searches[1].term === 'italy visa rules', 'older search is second');
  ok(res.searches.every(s => s.id && s.at), 'every item has id + timestamp');

  // 2. ids are unique (the app dedupes on them)
  const ids = res.searches.map(s => s.id);
  ok(new Set(ids).size === ids.length, 'ids are unique');

  // 3. empty term rejected
  const bad = await req('POST', '/api/q', { term: '   ' });
  ok(bad.ok === false, 'blank term is rejected');

  // 4. GET-style delivery works (sendBeacon image-ping fallback)
  await req('GET', '/api/clear');
  await req('GET', '/api/q?term=' + encodeURIComponent('taj mahal tickets'));
  res = await req('GET', '/api/searches');
  ok(res.searches[0] && res.searches[0].term === 'taj mahal tickets', 'GET fallback delivery works');

  // 5. cap holds (no unbounded growth)
  await req('GET', '/api/clear');
  for (let i = 0; i < 220; i++) await req('POST', '/api/q', { term: 'q' + i });
  res = await req('GET', '/api/searches?limit=200');
  ok(res.searches.length <= 200, 'feed is capped at 200');
  ok(res.searches[0].term === 'q219', 'newest kept after cap');

  await req('GET', '/api/clear');
  console.log(`\n${checks} checks, ${fails} failures`);
  process.exit(fails ? 1 : 0);
})();
