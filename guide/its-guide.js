/*
 * its 보관함 비교 테스트용 온보딩 가이드 (테스트 세션 전용: 주소에 guide=1 이 있을 때만 동작)
 * - 5초 후: "전체" 탭 안내 → 전체 탭 진입 10초 후: 모으기 진입점 안내(c: 보관 탭, b: 모아서 보기 버튼)
 * - 오른쪽 위 닫기(X): 체험 종료 기록(its_vault_done_1/2)을 설문 안내 화면(opener)에 전달하고 창을 닫음
 * - 60초 동안 모으기 동작이 없으면 안내 토스트 1회
 * its 쪽 코드는 수정하지 않고, DOM 위에 오버레이만 얹는다 (자세한 연결 방법은 guide/README.md).
 */
(function () {
  var q = new URLSearchParams(location.search);
  if (q.get('guide') !== '1' || window.__itsVaultGuide) return;
  window.__itsVaultGuide = true;

  var V = q.get('v') === 'b' ? 'b' : 'c';             // c: 보관-비우기(1), b: 모으기-비우기(2)
  var N = V === 'c' ? '1' : '2';
  var T = window.__itsVaultGuideTiming || { first: 5000, second: 10000, idle: 60000 };
  var RET = q.get('ret') || '';
  var KEY = 'its_vault_guide_' + V;
  var seen = {};
  try { seen = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) {}
  function mark(k) { seen[k] = 1; try { sessionStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) {} }

  /* ---------- 스타일 ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.ivg-tip{position:fixed;z-index:2147483000;max-width:240px;background:#1a1a2e;color:#fff;font:600 14px/1.5 -apple-system,"Pretendard","Noto Sans KR",sans-serif;padding:10px 14px;border-radius:12px;pointer-events:none;animation:ivgIn .25s ease both}' +
    '.ivg-ring{position:fixed;z-index:2147482999;border:2px solid #1a1a2e;border-radius:12px;box-shadow:0 0 0 4px #fff;pointer-events:none;animation:ivgPulse 1.4s ease-in-out infinite}' +
    '.ivg-arrow{position:absolute;width:10px;height:10px;background:#1a1a2e;transform:rotate(45deg)}' +
    '.ivg-x{position:fixed;z-index:2147483001;top:8px;right:8px;width:36px;height:36px;border:0;border-radius:50%;background:#1a1a2e;color:#fff;font:600 18px/36px sans-serif;text-align:center;cursor:pointer;padding:0}' +
    '.ivg-toast{position:fixed;z-index:2147483002;left:50%;bottom:84px;transform:translateX(-50%);width:calc(100% - 32px);max-width:420px;background:#1a1a2e;color:#fff;font:600 14px/1.5 -apple-system,"Pretendard","Noto Sans KR",sans-serif;padding:14px 16px;border-radius:14px;animation:ivgIn .25s ease both}' +
    '.ivg-end{position:fixed;inset:0;z-index:2147483003;background:#fff;color:#1a1a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font:500 15px/1.7 -apple-system,"Pretendard","Noto Sans KR",sans-serif}' +
    '.ivg-end b{font-size:18px}.ivg-end a{display:inline-block;margin-top:6px;padding:14px 28px;border-radius:999px;background:#1a1a2e;color:#fff;text-decoration:none;font-weight:700}' +
    '@keyframes ivgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1}}' +
    '@keyframes ivgPulse{50%{box-shadow:0 0 0 8px #1a1a2e22}}';
  document.head.appendChild(css);

  /* ---------- 요소 찾기 ---------- */
  function mainTab(label) {
    var b = document.querySelectorAll('nav[aria-label="메인 탭"] button');
    for (var i = 0; i < b.length; i++) if (b[i].textContent.replace(/\d+$/, '').trim() === label) return b[i];
    return null;
  }
  function onAllTab() { var t = mainTab('전체'); return !!(t && t.getAttribute('aria-current') === 'page'); }
  function entryEl() {
    if (V === 'c') return document.getElementById('collect-vault-tab') || mainTab('보관');
    return document.querySelector('button[aria-label="모아서 보기"]') || document.getElementById('collect-stack') || document.querySelector('button[aria-label^="모으는 중"], button[aria-label^="모은 카드"]');
  }
  var COLLECT_SEL = '#collect-vault-tab,#collect-stack,button[aria-label*="모아서 보기"],button[aria-label*="모으는 중"],button[aria-label*="모은 카드"],button[aria-label*="되돌리기"],button[aria-label*="보관함에 담기"],button[aria-label*="보관함에서 빼기"]';

  /* ---------- 하이라이트 ---------- */
  var cur = null;
  function hide() { if (cur) { cur.ring.remove(); cur.tip.remove(); window.removeEventListener('resize', cur.fn); window.removeEventListener('scroll', cur.fn, true); clearInterval(cur.iv); cur = null; } }
  function show(key, getEl, text) {
    hide();
    var ring = document.createElement('div'); ring.className = 'ivg-ring';
    var tip = document.createElement('div'); tip.className = 'ivg-tip'; tip.setAttribute('role', 'status'); tip.textContent = text;
    var ar = document.createElement('i'); ar.className = 'ivg-arrow'; tip.appendChild(ar);
    document.body.appendChild(ring); document.body.appendChild(tip);
    function place() {
      var el = getEl(); if (!el) { ring.style.display = tip.style.display = 'none'; return; }
      var r = el.getBoundingClientRect(); if (!r.width) { ring.style.display = tip.style.display = 'none'; return; }
      ring.style.display = tip.style.display = '';
      ring.style.left = (r.left - 4) + 'px'; ring.style.top = (r.top - 4) + 'px'; ring.style.width = (r.width + 8) + 'px'; ring.style.height = (r.height + 8) + 'px';
      var tw = tip.offsetWidth, th = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      var below = r.top + r.height / 2 < vh / 2;                       // 대상이 위쪽에 있으면 말풍선은 아래
      var left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), vw - tw - 8);
      tip.style.left = left + 'px';
      tip.style.top = (below ? r.bottom + 14 : r.top - th - 14) + 'px';
      ar.style.left = Math.min(Math.max(12, r.left + r.width / 2 - left - 5), tw - 22) + 'px';
      ar.style[below ? 'top' : 'bottom'] = '-5px'; ar.style[below ? 'bottom' : 'top'] = 'auto';
    }
    cur = { key: key, ring: ring, tip: tip, fn: place, iv: setInterval(place, 400) };
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); place();
  }

  /* ---------- 상호작용 감지: 한 번이라도 누르면 그 사인은 사라지고 다시 안 뜸 ---------- */
  var collected = false, started = Date.now();
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('button,a,[role="tab"]');
    if (!t) return;
    if (t.classList.contains('ivg-x')) return;
    if (cur && cur.key === 'tab' && mainTab('전체') && mainTab('전체').contains(t)) { mark('tab'); hide(); }
    if (t.matches && t.matches(COLLECT_SEL)) {
      collected = true; mark('entry'); mark('idle');
      if (cur && cur.key === 'entry') hide();
      hideToast();
    }
  }, true);

  /* ---------- 1) 5초 후 전체 탭 / 2) 전체 탭 진입 10초 후 모으기 진입점 ---------- */
  var entryTimer = null;
  setTimeout(function () {
    if (seen.tab || onAllTab()) { mark('tab'); return; }
    show('tab', function () { return mainTab('전체'); }, '여기를 눌러 전체 목록으로 가보세요');
  }, T.first);
  setInterval(function () {
    if (!onAllTab()) { if (entryTimer) { clearTimeout(entryTimer); entryTimer = null; } return; }
    if (cur && cur.key === 'tab') { mark('tab'); hide(); }
    if (seen.entry || entryTimer) return;
    entryTimer = setTimeout(function () {
      entryTimer = null;
      if (seen.entry || collected || !onAllTab()) return;
      show('entry', entryEl, V === 'c' ? '여기서 모은 카드를 봐요' : '여기를 눌러 모으기를 시작해요');
    }, T.second);
  }, 300);

  /* ---------- 4) 60초간 모으기 동작이 없으면 토스트 1회 ---------- */
  var toast = null;
  function hideToast() { if (toast) { toast.remove(); toast = null; } }
  setTimeout(function () {
    if (seen.idle || collected) return;
    mark('idle');
    toast = document.createElement('div'); toast.className = 'ivg-toast'; toast.setAttribute('role', 'status');
    toast.textContent = '모으기 체험은 끝나셨나요? 오른쪽 상단의 닫기 버튼을 눌러 나오면 돼요.';
    document.body.appendChild(toast);
    setTimeout(hideToast, 8000);
  }, T.idle);

  /* ---------- 3) 닫기(X): 체험 종료 기록 + 창 닫기(안 닫히면 안내 화면) ---------- */
  var x = document.createElement('button');
  x.className = 'ivg-x'; x.type = 'button'; x.setAttribute('aria-label', '체험 끝내기 (닫기)'); x.textContent = '✕';
  x.onclick = function () {
    hide(); hideToast();
    try { if (window.opener) window.opener.postMessage({ type: 'its-vault-done', n: N }, '*'); } catch (e) {}
    try { window.close(); } catch (e) {}
    setTimeout(function () {
      if (document.querySelector('.ivg-end')) return;
      var d = document.createElement('div'); d.className = 'ivg-end';
      d.innerHTML = '<b>체험을 마쳤어요</b><span>이 창을 닫고 설문으로 돌아가 주세요.</span>' +
        (RET ? '<a href="' + RET.replace(/"/g, '') + '">설문 안내로 돌아가기</a>' : '');
      document.body.appendChild(d);
    }, 350);
  };
  document.body.appendChild(x);
})();
