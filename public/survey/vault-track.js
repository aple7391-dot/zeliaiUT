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
  // 회차가 바뀐 기기(1·2회차 참여자가 또 하는 경우)는 예전 기록을 비우고 새로 시작한다:
  // - 체험 완료 표시(its_vault_done_*): 안 했는데 '체험 완료'·설문 버튼이 열려 있으면 헤맨다
  // - 설문 진행 상태(its_vault_survey*): 예전 답이나 '이미 제출' 화면이 남지 않게
  // - 기기 ID(its_vault_pid): 같은 ID면 서버가 '이미 제출한 사람'으로 보고 이번 회차 응답을 저장하지 않는다 → 새 ID
  // 이 파일이 pid 를 읽기 전에 해야 하므로 맨 앞에서 한다. ROUND 는 index.html 의 ROUND 와 같은 값.
  var ROUND = '3', ROUND_KEY = 'its_ut_round';
  try {
    if (localStorage.getItem(ROUND_KEY) !== ROUND) {
      ['its_vault_done_1', 'its_vault_done_2', PID_KEY].forEach(function (k) { localStorage.removeItem(k); });
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('its_vault_survey') === 0) localStorage.removeItem(k); });
      localStorage.setItem(ROUND_KEY, ROUND);
    }
  } catch (e) {}
  var pid = null;
  try { pid = localStorage.getItem(PID_KEY); if (!pid) { pid = uuid(); localStorage.setItem(PID_KEY, pid); } } catch (e) {}
  if (!pid) pid = uuid();
  window.vaultPid = pid; // its 링크에 ?pid= 로 붙여 its 이벤트와 설문을 같은 참여자로 잇는다

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
