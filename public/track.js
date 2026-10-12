/*
 * UT 행동 기록 (개선 전 / 개선 후 화면 공용)
 *
 * 보려는 것
 *   1) 어디서 헤매는가      → UT Idle(멈춰 있음), UT Click(dead_click: 반응 없는 곳 누름, 같은 곳 반복 클릭)
 *   2) 어디에 오래 머무는가 → UT View(place, t_ms 로 체류 시간 계산)
 *   3) 목표를 달성하지 않고 '성공했어요'를 눌렀는가
 *        → 목표 = 모델 선택/개발자 모드 전환 후 '채팅 입력칸 클릭'
 *        → UT Goal Reached 가 있는 세션과 UT Result(result=success, goal_reached=false) 비교
 *
 * 개인정보: 입력창에 적은 글자는 수집하지 않습니다. 버튼 문구/요소 이름/좌표/화면 이름만 기록합니다.
 * 전송: 믹스패널(MIXPANEL_TOKEN 환경변수) → 토큰이 없으면 /api/events(Supabase)
 * 사용법: <script src="track.js" data-variant="before"></script>
 */
(function () {
  var me = document.currentScript;
  var VARIANT = (me && me.getAttribute('data-variant')) || 'unknown';
  var API = (me && me.getAttribute('data-api')) || 'api/events';
  var CONFIG_API = (me && me.getAttribute('data-config')) || 'api/config';
  var OVERLAYS = ['sheet', 'agg', 'multi', 'agent', 'drawer', 'pop', 'giveUpBox', 'taskTip'];

  /* ---------- 사람이 읽는 이름 ---------- */
  var SCREEN_LABEL = {
    // 개선 전
    's-voice': 'AI 채팅(음성)', 's-set': '설정', 's-web': '홈(개발자 모드·웹)', 's-rt': '실시간 대화', 's-ocr': 'OCR', 's-hist': '기록',
    // 개선 후
    's-home': '홈', 's-search': '질문 입력', 's-load': '로딩', 's-ans': '답변', 's-agent': '에이전트 입력',
    's-agans': '에이전트 답변', 's-ahist': '에이전트 기록'
  };
  var OVERLAY_LABEL = {
    sheet: 'AI 포털 메뉴', agg: '에그리게이터 메뉴', multi: '멀티브레인 메뉴', agent: '에이전트 메뉴', drawer: '사이드 메뉴',
    pop: '팝업(광고)', giveUpBox: '도움말 팝업', taskTip: '과제 안내 문구'
  };
  var TAB_LABEL = { ocr: 'OCR', home: '홈', ai: 'AI 채팅', hist: '기록', set: '설정', rt: '실시간 대화' };

  /* ---------- 퍼널: 목표(goal)를 달성했는지 판단하는 단계 ---------- */
  function has(sel) { return !!document.querySelector(sel); }
  // 클릭으로 판정하는 단계용 플래그 (아래 click 핸들러에서 설정)
  var flag = { input_clicked: false };
  var FUNNELS = {
    // 개선 전: 설정 > 개발자 모드 ON > 홈(웹) 전환 > 채팅 입력칸 클릭(= 목표) > 메시지 전송
    before: {
      goal: 'input_clicked',
      steps: [
        ['settings_open', '설정 진입', function (c) { return c.screen === 's-set'; }],
        ['devmode_on', '개발자 모드 켜기', function () { return has('#devSw.on'); }],
        ['web_home', '홈(개발자 모드) 전환', function (c) { return c.screen === 's-web'; }],
        ['input_clicked', '채팅 입력칸 클릭 = 목표', function () { return flag.input_clicked; }],
        ['chat_sent', '메시지 전송', function () { return has('#chatMain .msg.me'); }]
      ]
    },
    // 개선 후: 포털 메뉴 > 서비스 > 모델 선택 > 채팅 화면 진입 > 채팅 입력칸 클릭(= 목표) > 질문 전송 > 답변
    after: {
      goal: 'input_clicked',
      steps: [
        ['portal_open', 'AI 포털 메뉴 열기', function (c) { return c.overlay === 'sheet'; }],
        ['service_open', '서비스 메뉴 열기', function (c) { return c.overlay === 'agg' || c.overlay === 'multi' || c.overlay === 'agent'; }],
        ['model_picked', '모델/에이전트 선택', function () { return has('#aggModels .mi2.sel, #multiModels .mi2.sel, #agentCats .mi2.sel'); }],
        ['chat_entered', '채팅 화면 진입', function (c) {
          if (c.screen === 's-agent') return true;
          return (c.screen === 's-search' || c.screen === 's-load' || c.screen === 's-ans') &&
            has('#s-search .comp.m-agg, #s-search .comp.m-multi');
        }],
        ['input_clicked', '채팅 입력칸 클릭 = 목표', function () { return flag.input_clicked; }],
        ['question_sent', '질문 전송', function (c) { return c.screen === 's-load'; }],
        ['answer_shown', '답변 확인', function (c) { return c.screen === 's-ans' || c.screen === 's-agans'; }]
      ]
    }
  };
  var FUNNEL = FUNNELS[VARIANT] || { goal: null, steps: [] };

  /* ---------- 공통 ---------- */
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
  var hit = {};            // 도달한 퍼널 단계
  var hitOrder = [];       // 도달 순서
  var goalAt = null;       // 목표 달성 시각(ms)
  var lastAct = Date.now();
  var idleCount = 0;

  function ctx() {
    var s = document.querySelector('.screen.active');
    var overlay = null;
    for (var i = 0; i < OVERLAYS.length; i++) {
      var el = document.getElementById(OVERLAYS[i]);
      if (el && el.classList.contains('show')) { overlay = OVERLAYS[i]; break; }
    }
    var tab = document.querySelector('nav button.active');
    var c = { screen: s ? s.id : null, overlay: overlay, tab: tab ? tab.getAttribute('data-t') : null };
    c.place = overlay ? (OVERLAY_LABEL[overlay] || overlay) : (c.screen ? (SCREEN_LABEL[c.screen] || c.screen) : null);
    return c;
  }
  function push(type, extra) {
    var c = ctx();
    var e = { seq: ++seq, type: type, t: Date.now() - t0, screen: c.screen, overlay: c.overlay, place: c.place };
    if (c.tab) { e.tab = c.tab; e.tab_label = TAB_LABEL[c.tab] || c.tab; }
    if (extra) for (var k in extra) if (extra[k] !== undefined && extra[k] !== null) e[k] = extra[k];
    buf.push(e);
    if (buf.length >= 25) flush();
  }

  /* ---------- 전송: Mixpanel(우선) / 토큰이 없으면 자체 서버(/api/events) ---------- */
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

  var EVENT_NAME = {
    start: 'UT Start', view: 'UT View', click: 'UT Click', idle: 'UT Idle',
    funnel: 'UT Funnel Step', goal: 'UT Goal Reached', result: 'UT Result', hidden: 'UT Hidden'
  };
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function post(url, body, type) {
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: type }))) return;
    } catch (e) {}
    try { fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body: body, keepalive: true, mode: 'no-cors' }); } catch (e) {}
  }
  var PROPS = ['screen', 'overlay', 'place', 'tab', 'tab_label', 'target', 'label', 'x', 'y', 'clickable', 'dead_click',
    'result', 'elapsed_ms', 'goal_reached', 'steps_hit', 'furthest_step_no', 'ms_to_goal', 'step', 'step_no', 'step_label',
    'idle_ms', 'w', 'h'];
  function flush(final) {
    if (!buf.length) return;
    if (!cfg) { if (!final) return; cfg = { mp_token: null }; } // 설정을 아직 못 받았고 종료 중이면 폴백
    var evs = buf.splice(0, buf.length);
    if (cfg.mp_token) {
      var data = evs.map(function (e) {
        var p = { token: cfg.mp_token, distinct_id: pid, time: t0 + (e.t || 0), $insert_id: sid + '-' + e.seq,
          variant: VARIANT, session_id: sid, t_ms: e.t };
        PROPS.forEach(function (k) { if (e[k] !== undefined && e[k] !== null) p[k] = e[k]; });
        return { event: EVENT_NAME[e.type] || ('UT ' + e.type), properties: p };
      });
      post('https://' + (cfg.mp_host || 'api.mixpanel.com') + '/track?ip=0',
        'data=' + encodeURIComponent(b64(JSON.stringify(data))), 'application/x-www-form-urlencoded');
    } else {
      post(API, JSON.stringify({ participant_id: pid, session_id: sid, variant: VARIANT, events: evs }), 'application/json');
    }
  }

  /* ---------- 퍼널 판정 ---------- */
  function evalFunnel() {
    var c = ctx();
    FUNNEL.steps.forEach(function (st, i) {
      if (hit[st[0]]) return;
      var ok = false;
      try { ok = !!st[2](c); } catch (e) {}
      if (!ok) return;
      hit[st[0]] = true; hitOrder.push(st[0]);
      push('funnel', { step: st[0], step_no: i + 1, step_label: st[1] });
      if (st[0] === FUNNEL.goal && goalAt === null) {
        goalAt = Date.now() - t0;
        push('goal', { step: st[0], step_no: i + 1, step_label: st[1], ms_to_goal: goalAt });
      }
    });
  }
  function furthest() {
    var n = 0;
    FUNNEL.steps.forEach(function (st, i) { if (hit[st[0]]) n = i + 1; });
    return n;
  }

  /* ---------- 클릭: 어떤 요소를 눌렀는지 / 반응 없는 곳을 눌렀는지 ---------- */
  var CLICKABLE = 'button,a,input,textarea,select,label,[role=button],[data-t],.sw,.item,.card,.mc,.mi2,.gb,.radio,.hi,.chip,.rq,.arrow-btn,.title-btn-area,.mic-btn,.circ,.composer';
  function describe(t) {
    var hitEl = t.closest ? t.closest(CLICKABLE) : null;
    var el = hitEl || t;
    var label = '';
    var tag = (el.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      label = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    }
    var cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0, 2).join('.');
    return {
      target: (el.id ? '#' + el.id : tag + (cls ? '.' + cls : '')).slice(0, 60),
      label: label || undefined,
      clickable: !!hitEl
    };
  }
  function act() { lastAct = Date.now(); idleCount = 0; }

  document.addEventListener('click', function (ev) {
    act();
    var d = describe(ev.target);
    var box = (document.getElementById('phone') || document.documentElement).getBoundingClientRect();
    var x = box.width ? Math.round((ev.clientX - box.left) / box.width * 100) : undefined;
    var y = box.height ? Math.round((ev.clientY - box.top) / box.height * 100) : undefined;

    // 채팅 입력칸 클릭(목표) 판정
    if (!flag.input_clicked && ev.target.closest) {
      var tg = ev.target;
      if (VARIANT === 'before') {
        flag.input_clicked = !!tg.closest('#msgIn, .cbox') && has('#devSw.on');
      } else if (VARIANT === 'after') {
        flag.input_clicked =
          (!!tg.closest('#s-search #searchIn, #s-search .comp .box') && has('#s-search .comp.m-agg, #s-search .comp.m-multi')) ||
          !!tg.closest('#s-agent .ag-in, #s-agent .ag-ta, #s-agent .ag-sel');
      }
    }

    var res = null;
    if (ev.target.closest) {
      if (ev.target.closest('#giveUp')) res = 'giveup';
      else if (ev.target.closest('#foundIt')) res = 'success';
    }
    if (res) {
      if (!resultSent) {
        resultSent = true;
        evalFunnel();
        // 핵심: '성공했어요'를 눌렀지만 목표를 달성하지 않았다면 goal_reached=false
        push('result', {
          result: res, elapsed_ms: Date.now() - t0, target: d.target, label: d.label,
          goal_reached: goalAt !== null, steps_hit: hitOrder.join('>') || 'none',
          furthest_step_no: furthest(), ms_to_goal: goalAt !== null ? goalAt : undefined
        });
      }
      flush(true);
      return;
    }
    push('click', { target: d.target, label: d.label, x: x, y: y, clickable: d.clickable, dead_click: d.clickable ? undefined : true });
    setTimeout(function () { evalFunnel(); check(); }, 0);   // 앱의 클릭 처리가 끝난 뒤 상태 판정
    setTimeout(function () { evalFunnel(); check(); }, 350); // 로딩 후 전환되는 화면까지
  }, true);
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (n) {
    document.addEventListener(n, act, { capture: true, passive: true });
  });

  /* ---------- 화면/오버레이 전환: 어디서 얼마나 머물렀는지 ---------- */
  var last = '';
  var pending = false;
  function check() {
    pending = false;
    var c = ctx();
    if (!c.screen) return;
    var key = c.screen + '|' + (c.overlay || '') + '|' + (c.tab || '');
    if (key !== last) { last = key; push('view'); }
    evalFunnel();
  }
  function schedule() { if (!pending) { pending = true; setTimeout(check, 0); } }
  try {
    new MutationObserver(schedule).observe(document.documentElement, {
      attributes: true, subtree: true, childList: true, attributeFilter: ['class']
    });
  } catch (e) {}

  /* ---------- 멈춰 있음(주저함): 8초 동안 아무 조작이 없으면 기록 ---------- */
  var IDLE_MS = 8000;
  setInterval(function () {
    if (resultSent || document.visibilityState === 'hidden') return;
    var idle = Date.now() - lastAct;
    if (idle >= IDLE_MS * (idleCount + 1) && idleCount < 8) {
      idleCount++;
      push('idle', { idle_ms: idle });
    }
  }, 1000);

  /* ---------- 세션 시작 / 종료 ---------- */
  push('start', { w: window.innerWidth, h: window.innerHeight });
  check();
  setInterval(function () { flush(); }, 10000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { push('hidden', { goal_reached: goalAt !== null, furthest_step_no: furthest() }); flush(true); }
  });
  window.addEventListener('pagehide', function () { flush(true); });
})();
