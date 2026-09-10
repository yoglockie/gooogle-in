/* Performer side. Polls the feed and shows searches newest-first. Same code the
   Android app runs. Disguised as "Notes" - tap Hide, triple-tap "Notes" to return. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  // Where to poll. Priority: ?api=… , saved value, else same origin (local dev).
  // In the packaged app there is no origin, so a saved URL is required and the
  // Set box is how you enter it once.
  var stored = '';
  try { stored = localStorage.getItem('peek.api') || ''; } catch (e) {}
  var api = (params.get('api') || stored || location.origin || '').replace(/\/$/, '');
  $('apiIn').value = api;

  var seen = {};          // id -> true, so we never show a search twice
  var items = [];         // newest first
  var firstLoad = true;
  var failures = 0;

  function setStat(on, txt) { $('dot').className = 'dot' + (on ? ' on' : ''); $('st').textContent = txt; }

  async function poll() {
    if (!api) { setStat(false, 'set relay URL below'); return; }
    try {
      var r = await fetch(api + '/api/searches?limit=50', { cache: 'no-store' });
      var data = await r.json();
      failures = 0;
      setStat(true, data.configured === false ? 'connected · store not set' : 'live');
      merge(data.searches || []);
    } catch (e) {
      failures++;
      setStat(false, failures > 2 ? 'offline · retrying' : 'reconnecting…');
    }
  }

  function merge(list) {
    // list is newest-first from the server. Add any ids we have not seen.
    var fresh = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it && it.id && !seen[it.id]) { seen[it.id] = true; fresh.push(it); }
    }
    if (!fresh.length) return;
    // prepend, keep newest first
    items = fresh.concat(items).sort(function (a, b) { return b.at - a.at; }).slice(0, 60);
    render(firstLoad ? null : fresh[0].id);
    firstLoad = false;
    if (navigator.vibrate) { try { navigator.vibrate(35); } catch (e) {} }
  }

  function render(newTopId) {
    var feed = $('feed');
    if (!items.length) { feed.innerHTML = '<div class="empty" id="empty">Waiting for a search…</div>'; return; }
    feed.innerHTML = items.map(function (it, i) {
      var cls = 'row' + (i === 0 ? ' top' : '') + (it.id === newTopId ? ' new' : '');
      return '<div class="' + cls + '"><span class="t">' + esc(it.term) + '</span>' +
             '<span class="m">' + ago(it.at) + '</span></div>';
    }).join('');
    feed.scrollTop = 0;
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 3) return 'just now';
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  setInterval(function () { if (items.length) render(); }, 5000);  // keep "ago" fresh

  /* controls */
  $('save').addEventListener('click', function () {
    api = $('apiIn').value.trim().replace(/\/$/, '');
    try { localStorage.setItem('peek.api', api); } catch (e) {}
    seen = {}; items = []; firstLoad = true; render();
    poll();
  });
  $('disguise').addEventListener('click', function () { $('cover').classList.add('on'); });

  var taps = 0, last = 0;
  $('coverTitle').addEventListener('click', function () {
    var now = Date.now();
    taps = now - last < 700 ? taps + 1 : 1; last = now;
    if (taps >= 3) { taps = 0; $('cover').classList.remove('on'); }
  });

  poll();
  setInterval(poll, 1500);   // the whole trick's heartbeat
})();
