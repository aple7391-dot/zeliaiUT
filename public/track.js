/*
 * UT 행동 기록 (개선 전 / 개선 후 화면 공용)
 *  - 무엇을 눌렀는지(click), 어느 화면/오버레이에 머물렀는지(view), 언제 포기/성공을 눌렀는지(result)
 *  - 입력창에 적은 글자는 수집하지 않습니다. 버튼 문구/요소 이름/좌표만 기록합니다.
 *  - 전송: 믹스패널(환경변수 MIXPANEL_TOKEN 이 있을 때) → 없으면 /api/events(Supabase)
 *  - 사용법: <script src="track.js" data-variant="before"></script>
 */
(function () {
  var me = document.currentScript;
  var VARIANT = (me && me.getAttribute('data-variant')) || 'unknown';
  var API = (me && me.getAttribute('data-api')) || 'api/events';
  var OVERLAYS = ['sheet', 'agg', 'multi', 'agent', 'drawer', 'pop', 'giveUpBox'];

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < 16; i++) a[i] = Math.random() * 256;
    a[6] = a[6] & 0x0f | 0x40; a[8] = a[8] & 0x3f | 0x80;
    var h = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }

  // 설문 응답과 같은 참가자 ID 를 쓴다 (설문 화면도 zeli_pid 를 사용)
  var pid = ls('zeli_pid');
  if (!pid) { pid = uuid(); ls('zeli_pid', pid); }
  var sid = uuid();
  var t0 = Date.now();
  var seq = 0;
  var buf = [];
  var resultSent = false;

  function ctx() {
    var s = document.querySelector('.screen.active');
    var overlay = null;
    for (var i = 0; i < OVERLAYS.length; i++) {
      var el = document.getElementById(OVERLAYS[i]);
      if (el && el.classList.contains('show')) { overlay = OVERLAYS[i]; break; }
    }
    var tab = document.querySelector('nav button.active');
    return { screen: s ? s.id : null, overlay: overlay, tab: tab ? tab.getAttribute('data-t') : null };
  }
  function push(type, extra) {
    var c = ctx();
    var e = { seq: ++seq, type: type, t: Date.now() - t0, screen: c.screen, overlay: c.overlay };
    if (c.tab) e.tab = c.tab;
    if (extra) for (var k in extra) if (extra[k] !== undefined && extra[k] !== null) e[k] = extra[k];
    buf.push(e);
    if (buf.length >= 25) flush();
  }
  /* ----- 전송: Mixpanel(우선) / 토큰이 없으면 자체 서버(/api/events) ----- */
  var CONFIG_API = (me && me.getAttribute('data-config')) || 'api/config';
  var CFG_KEY = 'zeli_track_cfg';
  var cfg = null;
  try { cfg = JSON.parse(ls(CFG_KEY) || 'null'); } catch (e) { cfg = null; }
  try {
    fetch(CONFIG_API, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
      cfg = { mp_token: c.mp_token || null, mp_host: c.mp_host || 'api.mixpanel.com' };
      ls(CFG_KEY, JSON.stringify(cfg));
      flush();
    }).catch(function () { if (!cfg) cfg = { mp_token: null }; });
  } catch (e) { cfg = { mp_token: null }; }

  var EVENT_NAME = { start: 'UT Start', view: 'UT View', click: 'UT Click', result: 'UT Result', hidden: 'UT Hidden' };
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function post(url, body, type) {
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: type }))) return;
    } catch (e) {}
    try { fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body: body, keepalive: true, mode: 'no-cors' }); } catch (e) {}
  }
  function flush(final) {
    if (!buf.length) return;
    if (!cfg) { if (!final) return; cfg = { mp_token: null }; } // 설정을 아직 못 받았고 종료 중이면 폴백
    var evs = buf.splice(0, buf.length);
    if (cfg.mp_token) {
      var data = evs.map(function (e) {
        var p = {
          token: cfg.mp_token, distinct_id: pid, time: t0 + (e.t || 0), $insert_id: sid + '-' + e.seq,
          variant: VARIANT, session_id: sid, t_ms: e.t, screen: e.screen, overlay: e.overlay, tab: e.tab,
          target: e.target, label: e.label, x: e.x, y: e.y, result: e.result, elapsed_ms: e.elapsed_ms,
          viewport_w: e.w, viewport_h: e.h
        };
        for (var k in p) if (p[k] === undefined || p[k] === null) delete p[k];
        return { event: EVENT_NAME[e.type] || ('UT ' + e.type), properties: p };
      });
      post('https://' + (cfg.mp_host || 'api.mixpanel.com') + '/track?ip=0',
        'data=' + encodeURIComponent(b64(JSON.stringify(data))), 'application/x-www-form-urlencoded');
    } else {
      post(API, JSON.stringify({ participant_id: pid, session_id: sid, variant: VARIANT, events: evs }), 'application/json');
    }
  }

  /* ----- 클릭: 어떤 요소를 눌렀는지 ----- */
  var CLICKABLE = 'button,a,input,textarea,select,label,[role=button],[data-t],.sw,.item,.card,.mc,.mi2,.gb,.radio,.hi,.msg,.chip,.rq,.arrow-btn,.title-btn-area';
  function describe(t) {
    var el = t.closest ? t.closest(CLICKABLE) : null;
    el = el || t;
    var label = '';
    var tag = (el.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      label = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    }
    var cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0, 2).join('.');
    return {
      target: (el.id ? '#' + el.id : tag + (cls ? '.' + cls : '')).slice(0, 60),
      label: label || undefined,
      data: el.getAttribute && el.getAttribute('data-t') || undefined
    };
  }
  document.addEventListener('click', function (ev) {
    var d = describe(ev.target);
    var box = (document.getElementById('phone') || document.documentElement).getBoundingClientRect();
    var x = box.width ? Math.round((ev.clientX - box.left) / box.width * 100) : undefined;
    var y = box.height ? Math.round((ev.clientY - box.top) / box.height * 100) : undefined;

    // 포기 / 성공 버튼: 결과 이벤트 + 즉시 전송 (페이지가 바로 이동하므로)
    var res = null;
    if (ev.target.closest) {
      if (ev.target.closest('#giveUp')) res = 'giveup';
      else if (ev.target.closest('#foundIt')) res = 'success';
    }
    if (res) {
      if (!resultSent) {
        resultSent = true;
        push('result', { result: res, elapsed_ms: Date.now() - t0, target: d.target, label: d.label });
      }
      flush(true);
      return;
    }
    push('click', { target: d.target, label: d.label, x: x, y: y, data: d.data });
  }, true);

  /* ----- 화면/오버레이 전환: 어디서 얼마나 머물렀는지 ----- */
  var last = '';
  var pending = false;
  function check() {
    pending = false;
    var c = ctx();
    if (!c.screen) return; // 화면이 아직 정해지지 않은 순간은 기록하지 않음
    var key = (c.screen || '') + '|' + (c.overlay || '') + '|' + (c.tab || '');
    if (key !== last) { last = key; push('view'); }
  }
  function schedule() { if (!pending) { pending = true; setTimeout(check, 0); } }
  try {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
  } catch (e) {}

  /* ----- 세션 시작 / 종료 ----- */
  push('start', { w: window.innerWidth, h: window.innerHeight });
  check();
  setInterval(function () { flush(); }, 10000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { push('hidden'); flush(true); } });
  window.addEventListener('pagehide', function () { flush(true); });
})();
