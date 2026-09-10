/* Spectator side. Looks like Google, and it is a real search: capture the term,
   send it to the feed, then hand off to genuine google.com. One global feed, so
   no room code - every search this page sends lands in the magician's app.

   The API base is same-origin by default (the page is served from the deploy).
   Override with ?api=https://your-relay if the page is hosted elsewhere. */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var api = (params.get('api') || location.origin).replace(/\/$/, '');

  var form = document.getElementById('f');
  var input = document.getElementById('q');

  var acct = params.get('acct');
  if (acct) document.getElementById('acct').textContent = acct.slice(0, 1).toUpperCase();

  function relayTerm(term) {
    var url = api + '/api/q';
    var payload = JSON.stringify({ term: term });
    var ok = false;
    // sendBeacon is built for "deliver this, then let the page navigate away".
    try { ok = navigator.sendBeacon(url, payload); } catch (e) {}
    if (!ok) {
      // webviews without sendBeacon: keepalive fetch, then image-ping fallback
      try {
        fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true, mode: 'cors' });
      } catch (e2) {
        try { new Image().src = api + '/api/q?term=' + encodeURIComponent(term) + '&t=' + Date.now(); } catch (e3) {}
      }
    }
  }

  function go(term) {
    term = (term || '').trim();
    if (!term) return;
    relayTerm(term);
    var dest = 'https://www.google.com/search?q=' + encodeURIComponent(term);
    setTimeout(function () { location.href = dest; }, 120);   // let the beacon flush
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); go(input.value); });
  document.getElementById('lucky').addEventListener('click', function () { go(input.value); });
})();
