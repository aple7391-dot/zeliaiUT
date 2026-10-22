/*
 * its 보관함 비교 테스트 설문 제출 처리 (서버 전용)
 * 젤리아이 응답과 섞이지 않도록 전용 테이블(vault_*)/전용 로컬 파일(vault_responses.jsonl)에만 저장한다.
 * 1) 응답 저장: Supabase(REST) → 환경변수가 없으면 data/vault_responses.jsonl 로컬 파일
 * 2) 메일 발송: nodemailer + 네이버 SMTP (실패해도 저장/제출은 정상 처리, 최대 2회 재시도)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CFG = require('../survey/config.js');

const T_SUB = 'vault_submissions';
const T_RES = 'vault_responses';
const LOCAL_FILE = path.join(__dirname, '..', 'data', 'vault_responses.jsonl');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');

function kst(date) {
  const p = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
  return p; // YYYY-MM-DD HH:mm
}

/* ---------- 검증 + 행 만들기 ---------- */
const M = ['1', '2'];
function buildRows(body) {
  const pid = String(body.participant_id || '');
  if (!/^[0-9a-fA-F-]{16,64}$/.test(pid)) throw new Error('invalid participant_id');
  const a = body.answers || {};
  const T = CFG.TEXT;
  const now = new Date().toISOString();
  const rows = [];
  const add = (question_id, variant, value, question_text) => {
    if (value === undefined) return;
    rows.push({
      id: crypto.randomUUID(), participant_id: pid, question_id,
      variant: variant || null, value, question_text: question_text || null, answered_at: now
    });
  };
  const order = ['1then2', '2then1'].includes(body.order) ? body.order : null;
  const device = ['mobile', 'pc'].includes(body.device_type) ? body.device_type : null;
  const prior = [T.priorYes, T.priorNo].includes(body.prior_use) ? body.prior_use : null;
  if (!prior) throw new Error('missing prior_use');
  M.forEach((m) => {
    add('seq', m, a['seq_' + m], T.seq);
    CFG.FEEDBACK.forEach(([k, label]) => add('feedback_' + k, m, a['fb_' + k + '_' + m], label));
  });
  add('compare_prefer', null, a.compare_prefer, T.comparePrefer);
  add('compare_familiar', null, a.compare_familiar, T.compareFamiliar);
  add('final_pick_reason', null, a.final_pick_reason, T.pickReason);
  add('version_mapping', null, CFG.MAPPING);

  const have = (q, v) => rows.some((r) => r.question_id === q && r.variant === (v || null) && String(r.value).trim() !== '');
  M.forEach((m) => {
    ['seq'].forEach((q) => { if (!have(q, m)) throw new Error('missing ' + q + ':' + m); });
  });
  ['compare_prefer', 'compare_familiar', 'final_pick_reason'].forEach((q) => {
    if (!have(q)) throw new Error('missing ' + q);
  });
  return {
    pid, rows,
    submission: {
      participant_id: pid,
      prior_use: prior,
      order_shown: order,
      device_type: device,
      created_at: now,
      mail_status: 'pending'
    }
  };
}

/* ---------- 저장소: Supabase / 로컬 JSONL ---------- */
function keyKind(key) {
  key = String(key || '').trim();
  if (/^sb_secret_/.test(key)) return 'sb_secret';
  if (/^sb_publishable_/.test(key)) return 'sb_publishable';
  if (key.split('.').length === 3) {
    try {
      const p = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'));
      return 'jwt:' + (p.role || 'unknown');
    } catch (e) { return 'jwt:unreadable'; }
  }
  return key ? 'unknown_format(len=' + key.length + ')' : 'empty';
}

function hasSupabase(env) { return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY); }

async function sb(env, method, pathAndQuery, body, extraHeaders) {
  // SUPABASE_URL 에 /rest/v1 이나 끝 슬래시가 붙어 있어도 프로젝트 주소로 정규화
  const base = String(env.SUPABASE_URL).trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '');
  const res = await fetch(base + '/rest/v1/' + pathAndQuery, {
    method,
    headers: Object.assign(
      { apikey: String(env.SUPABASE_SERVICE_ROLE_KEY).trim(), 'Content-Type': 'application/json' },
      // 기존 JWT 형식 키만 Authorization 으로도 전달 (sb_secret_* 키는 apikey 헤더만 사용)
      keyKind(env.SUPABASE_SERVICE_ROLE_KEY).startsWith('jwt:') ? { Authorization: 'Bearer ' + String(env.SUPABASE_SERVICE_ROLE_KEY).trim() } : {},
      extraHeaders || {}
    ),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return res;
}

function localRead() {
  try {
    return fs.readFileSync(LOCAL_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (e) { return []; }
}
function localAppend(obj) {
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  fs.appendFileSync(LOCAL_FILE, JSON.stringify(obj) + '\n');
}

async function persist(env, built) {
  if (hasSupabase(env)) {
    // 중복 제출 방지: participant_id 기본키 충돌(409) → 이미 제출됨
    const fail = async (table, res) => {
      const txt = await res.text();
      let j = {}; try { j = JSON.parse(txt); } catch (e) {}
      const err = new Error('supabase ' + table + ' ' + res.status + ' ' + txt);
      err.reason = '[key=' + keyKind(env.SUPABASE_SERVICE_ROLE_KEY) + '] supabase_' + table + '_' + res.status + (j.code ? '_' + j.code : '') + (j.message ? ' (' + String(j.message).slice(0, 100) + ')' : '');
      return err;
    };
    let r1;
    try { r1 = await sb(env, 'POST', T_SUB, built.submission, { Prefer: 'return=minimal' }); }
    catch (e) { const err = new Error(e.message); err.reason = 'supabase_unreachable (SUPABASE_URL 확인)'; throw err; }
    if (r1.status === 409) {
      // 이전 제출이 응답 저장 단계에서 실패해 submissions 만 남은 경우(응답 0건)는 중복이 아니므로 이어서 저장
      let hasResponses = true;
      try {
        const chk = await sb(env, 'GET', T_RES + '?select=id&limit=1&participant_id=eq.' + encodeURIComponent(built.pid));
        if (chk.ok) hasResponses = (await chk.json()).length > 0;
      } catch (e) { /* 확인 실패 시 중복으로 처리 */ }
      if (hasResponses) return { duplicate: true, where: 'supabase' };
    } else if (!r1.ok) throw await fail(T_SUB, r1);
    let r2 = await sb(env, 'POST', T_RES, built.rows, { Prefer: 'return=minimal' });
    if (!r2.ok) {
      // responses.question_text 컬럼이 아직 없으면(PGRST204) 응답 저장이 막히지 않도록 컬럼 없이 재시도
      const txt = await r2.clone().text();
      if (/question_text/.test(txt)) {
        console.warn('[survey] responses.question_text 컬럼 없음 → supabase/schema.sql 의 alter 문을 실행하세요');
        r2 = await sb(env, 'POST', T_RES, built.rows.map((r) => { const c = Object.assign({}, r); delete c.question_text; return c; }), { Prefer: 'return=minimal' });
      }
    }
    if (!r2.ok) {
      // 응답 저장 실패 시 submissions 행을 되돌려 재제출이 가능하게 함
      try { await sb(env, 'DELETE', T_SUB + '?participant_id=eq.' + encodeURIComponent(built.pid), undefined, { Prefer: 'return=minimal' }); } catch (e) {}
      throw await fail(T_RES, r2);
    }
    return { duplicate: false, where: 'supabase' };
  }
  console.warn('[survey] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 → data/vault_responses.jsonl 에 로컬 저장');
  try {
    const exists = localRead().some((l) => l.type === 'submission' && l.participant_id === built.pid);
    if (exists) return { duplicate: true, where: 'local' };
    localAppend({ type: 'submission', ...built.submission });
    built.rows.forEach((r) => localAppend({ type: 'response', ...r }));
    return { duplicate: false, where: 'local' };
  } catch (e) {
    // 서버리스(읽기 전용 파일시스템)에서는 로컬 저장이 불가 → 환경변수 누락이 원인
    const err = new Error('local write failed: ' + e.message);
    err.reason = 'supabase_env_missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 서버에 없음)';
    throw err;
  }
}

async function setMailStatus(env, pid, status, where) {
  try {
    if (where === 'supabase') {
      await sb(env, 'PATCH', T_SUB + '?participant_id=eq.' + encodeURIComponent(pid), { mail_status: status }, { Prefer: 'return=minimal' });
    } else {
      localAppend({ type: 'mail_status', participant_id: pid, mail_status: status, at: new Date().toISOString() });
    }
  } catch (e) { console.warn('[survey] mail_status 기록 실패:', e.message); }
}

/* ---------- 메일 ---------- */
function valText(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function buildMail(built, extra) {
  const L = CFG.LABELS;
  const tag = CFG.MAIL_TAG;
  const val = (q, v) => { const r = built.rows.find((x) => x.question_id === q && x.variant === (v || null)); return r ? r.value : undefined; };
  const tbl = (items) => '<table cellpadding="8" style="border-collapse:collapse;width:100%">' +
    items.map(([k, v]) => '<tr><td style="border:1px solid #ddd;width:34%;background:#f5f5f7;vertical-align:top">' + esc(k) +
      '</td><td style="border:1px solid #ddd;vertical-align:top">' + nl2br(valText(v)) + '</td></tr>').join('') + '</table>';
  const block = (m) => '<h3 style="margin:24px 0 8px">' + esc(L[m]) + ' (내부: ' + esc(CFG.MAPPING[m]) + ')</h3>' + tbl([
    ['쉬웠나요 (1~7)', val('seq', m)],
    ...CFG.FEEDBACK.map(([k, label]) => [label, val('feedback_' + k, m)])
  ]);
  const cmp = '<h3 style="margin:24px 0 8px">비교 · 마무리</h3>' + tbl(
    ['compare_prefer', 'compare_familiar', 'final_pick_reason']
      .map((q) => [built.rows.find((x) => x.question_id === q).question_text, val(q)]));
  const sub = built.submission;
  const meta = '<p style="color:#666;font-size:13px">participant_id: ' + esc(built.pid) +
    '<br>사전 사용 경험(prior_use): ' + esc(sub.prior_use) + '<br>노출 순서: ' + esc(sub.order_shown || '알 수 없음') + ' · 기기: ' + esc(sub.device_type || '알 수 없음') +
    (extra && extra.test ? '<br><b>※ 테스트 메일</b>' : '') + '</p>';
  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,\'Noto Sans KR\',sans-serif;max-width:640px;margin:auto">' +
    '<p style="font-weight:800;margin-bottom:4px">' + esc(tag) + '</p>' +
    '<h2>보관함 비교 테스트 응답</h2>' + meta + block('1') + block('2') + cmp + '</div>';
  return {
    subject: tag + ' ' + built.pid.slice(0, 8) + ' · ' + kst(new Date()),
    html
  };
}

function smtpConfig(env) {
  const user = String(env.SMTP_USER || env.NAVER_SMTP_USER || '').trim();
  // 구글 앱 비밀번호는 "abcd efgh ijkl mnop" 처럼 공백이 섞여 복사되는 경우가 많아 제거
  const pass = String(env.SMTP_PASS || env.NAVER_SMTP_PASS || '').replace(/\s+/g, '');
  const domain = (user.split('@')[1] || '').toLowerCase();
  let host = String(env.SMTP_HOST || '').trim();
  if (!host) {
    if (domain === 'gmail.com' || domain === 'googlemail.com') host = 'smtp.gmail.com';
    else if (domain === 'naver.com') host = 'smtp.naver.com';
    else if (domain) host = 'smtp.' + domain;
    else host = 'smtp.naver.com';
  }
  return { user, pass, host, port: Number(env.SMTP_PORT || 465) };
}

// 반환: { status: 'sent'|'skipped'|'failed', detail }  (detail 에는 비밀값이 들어가지 않음)
async function sendMail(env, built, extra) {
  const cfg = smtpConfig(env);
  if (!cfg.user || !cfg.pass) {
    const missing = [!cfg.user && 'NAVER_SMTP_USER(또는 SMTP_USER)', !cfg.pass && 'NAVER_SMTP_PASS(또는 SMTP_PASS)'].filter(Boolean).join(', ');
    console.warn('[survey] 메일 환경변수 없음 → 발송 건너뜀: ' + missing);
    return { status: 'skipped', detail: 'missing env: ' + missing };
  }
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch (e) {
    console.warn('[survey] nodemailer 미설치 → 메일 발송 건너뜀 (npm install 필요)');
    return { status: 'skipped', detail: 'nodemailer not installed' };
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass }
  });
  const mail = buildMail(built, extra);
  const to = String(env.MAIL_TO || '').trim() || cfg.user;
  let lastErr;
  for (let i = 0; i < 3; i++) { // 최초 1회 + 재시도 최대 2회
    try {
      await transporter.sendMail({ from: cfg.user, to, subject: mail.subject, html: mail.html });
      return { status: 'sent', detail: cfg.host };
    } catch (e) {
      lastErr = e;
      console.warn('[survey] 메일 발송 실패(' + (i + 1) + '/3):', e.message);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  console.warn('[survey] 메일 최종 실패:', lastErr && lastErr.message);
  const code = lastErr && (lastErr.code || lastErr.responseCode);
  return { status: 'failed', detail: cfg.host + ' ' + (code || '') + ' ' + String((lastErr && lastErr.message) || '').slice(0, 90) };
}

/* ---------- 외부 진입점 ---------- */
async function handleSubmit(body, env) {
  env = env || process.env;
  let built;
  try { built = buildRows(body || {}); }
  catch (e) { return { status: 400, json: { ok: false, error: e.message } }; }

  let saved;
  try { saved = await persist(env, built); }
  catch (e) {
    console.error('[survey] 저장 실패:', e.message);
    return { status: 500, json: { ok: false, error: 'save_failed', reason: e.reason || 'unknown' } };
  }
  if (saved.duplicate) return { status: 200, json: { ok: true, duplicate: true } };

  let mail = { status: 'skipped', detail: '' };
  try { mail = await sendMail(env, built); }
  catch (e) { console.warn('[survey] 메일 처리 예외:', e.message); mail = { status: 'failed', detail: String(e.message).slice(0, 90) }; }
  await setMailStatus(env, built.pid, mail.status, saved.where);
  return { status: 200, json: { ok: true, mail_status: mail.status, mail_detail: mail.detail, stored: saved.where } };
}

module.exports = { handleSubmit, buildRows, buildMail, sendMail, esc, sb, hasSupabase, keyKind };
