/*
 * 보관함 비교 테스트 행동 기록 (index.html / survey.html 공용)
 * its 사이트는 건드리지 않고, 이 두 페이지에서 일어난 일만 /api/vault-events 로 보낸다.
 * 사용법: <script src="survey/vault-track.js" data-page="index"></script>  →  window.vaultTrack(type, variant, extra)
 */
(function () {
  var me = document.currentScript;
  var PAGE = (me && me.getAttribute('data-page')) || 'unknown';
  var PID_KEY = 'its_vault_pid';
  var API = 'api/vault-events';

  function uuid() {
    var a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    a[6] = a[6] & 0x0f | 0x40; a[8] = a[8] & 0x3f | 0x80;
    var h = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  var pid = null;
  try { pid = localStorage.getItem(PID_KEY); if (!pid) { pid = uuid(); localStorage.setItem(PID_KEY, pid); } } catch (e) {}
  if (!pid) pid = uuid();

  function send(ev) {
    var body = JSON.stringify({ participant_id: pid, events: [ev] });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(API, new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try { fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); } catch (e) {}
  }
  window.vaultTrack = function (type, variant, extra) {
    send({ id: uuid(), page: PAGE, type: type, variant: variant || null, t: Date.now(), extra: extra || null });
  };
  window.vaultTrack('page_view');
})();
