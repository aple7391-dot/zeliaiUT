/*
 * 설문 제출 처리 (서버 전용)
 * 1) 응답 저장: Supabase(REST) → 환경변수가 없으면 data/responses.jsonl 로컬 파일
 * 2) 메일 발송: nodemailer + 네이버 SMTP (실패해도 저장/제출은 정상 처리, 최대 2회 재시도)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CFG = require('../survey/config.js');

const LOCAL_FILE = path.join(__dirname, '..', 'data', 'responses.jsonl');

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
function buildRows(body) {
  const pid = String(body.participant_id || '');
  if (!/^[0-9a-fA-F-]{16,64}$/.test(pid)) throw new Error('invalid participant_id');
  const a = body.answers || {};
  const now = new Date().toISOString();
  const rows = [];
  const add = (question_id, variant, value) => {
    if (value === undefined) return;
    rows.push({
      id: crypto.randomUUID(), participant_id: pid, question_id,
      variant: variant || null, value, answered_at: now
    });
  };
  ['before', 'after'].forEach((v) => {
    add('seq', v, a['seq_' + v]);
    add('open_unexpected', v, a['open_' + v]);
    add('first_impression', v, a['imp_' + v]);
    add('intent_score', v, a['intent_' + v]);
    add('intent_reason', v, a['intent_open_' + v]);
    if (body.task_result && body.task_result[v]) add('task_result', v, body.task_result[v]);
  });
  add('compare_choice', null, a.compare_choice);
  add('compare_reason', null, a.compare_reason);
  add('first_impression_order', null, body.first_impression_order);
  add('compare_layout', null, body.compare_layout);
  const required = ['seq', 'open_unexpected', 'first_impression', 'intent_score'];
  required.forEach((q) => ['before', 'after'].forEach((v) => {
    if (!rows.some((r) => r.question_id === q && r.variant === v)) throw new Error('missing ' + q + ':' + v);
  }));
  if (!rows.some((r) => r.question_id === 'compare_choice')) throw new Error('missing compare_choice');
  return {
    pid, rows,
    submission: {
      participant_id: pid,
      first_version: body.first_version || null,
      created_at: now,
      mail_status: 'pending'
    }
  };
}

/* ---------- 저장소: Supabase / 로컬 JSONL ---------- */
function hasSupabase(env) { return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY); }

async function sb(env, method, pathAndQuery, body, extraHeaders) {
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + pathAndQuery, {
    method,
    headers: Object.assign({
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    }, extraHeaders || {}),
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
      err.reason = 'supabase_' + table + '_' + res.status + (j.code ? '_' + j.code : '') + (j.message ? ' (' + String(j.message).slice(0, 100) + ')' : '');
      return err;
    };
    let r1;
    try { r1 = await sb(env, 'POST', 'submissions', built.submission, { Prefer: 'return=minimal' }); }
    catch (e) { const err = new Error(e.message); err.reason = 'supabase_unreachable (SUPABASE_URL 확인)'; throw err; }
    if (r1.status === 409) return { duplicate: true, where: 'supabase' };
    if (!r1.ok) throw await fail('submissions', r1);
    const r2 = await sb(env, 'POST', 'responses', built.rows, { Prefer: 'return=minimal' });
    if (!r2.ok) throw await fail('responses', r2);
    return { duplicate: false, where: 'supabase' };
  }
  console.warn('[survey] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 → data/responses.jsonl 에 로컬 저장');
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
      await sb(env, 'PATCH', 'submissions?participant_id=eq.' + encodeURIComponent(pid), { mail_status: status }, { Prefer: 'return=minimal' });
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
  const by = (q, v) => { const r = built.rows.find((x) => x.question_id === q && x.variant === v); return r ? r.value : undefined; };
  const one = (q) => { const r = built.rows.find((x) => x.question_id === q); return r ? r.value : undefined; };
  const block = (v) => {
    const items = [
      ['SEQ (1~7)', by('seq', v)],
      ['예상과 달랐던 점 / 감정', by('open_unexpected', v)],
      ['첫인상 (어떤 서비스라고 생각했는지)', by('first_impression', v)],
      ['재사용 의향 (1~7)', by('intent_score', v)],
      ['재사용 상황 / 이유', by('intent_reason', v)],
      ['과제 결과', (by('task_result', v) || {}).result]
    ];
    return '<h3 style="margin:24px 0 8px">' + esc(L[v]) + '</h3><table cellpadding="8" style="border-collapse:collapse;width:100%">' +
      items.map(([k, val]) => '<tr><td style="border:1px solid #ddd;width:34%;background:#f6f7fb;vertical-align:top">' + esc(k) +
        '</td><td style="border:1px solid #ddd;vertical-align:top">' + nl2br(valText(val)) + '</td></tr>').join('') + '</table>';
  };
  const choice = one('compare_choice');
  const choiceLabel = choice === 'same' ? CFG.TEXT.compareSame : (L[choice] || valText(choice));
  const cmp = '<h3 style="margin:24px 0 8px">비교</h3><table cellpadding="8" style="border-collapse:collapse;width:100%">' +
    '<tr><td style="border:1px solid #ddd;width:34%;background:#f6f7fb">더 쉬웠던 쪽</td><td style="border:1px solid #ddd">' + esc(choiceLabel) + '</td></tr>' +
    '<tr><td style="border:1px solid #ddd;background:#f6f7fb;vertical-align:top">이유</td><td style="border:1px solid #ddd">' + nl2br(valText(one('compare_reason'))) + '</td></tr></table>';
  const meta = '<p style="color:#666;font-size:13px">participant_id: ' + esc(built.pid) +
    '<br>첫 체험 버전: ' + esc(built.submission.first_version ? (L[built.submission.first_version] || built.submission.first_version) : '알 수 없음') +
    '<br>첫인상 노출 순서: ' + esc(valText(one('first_impression_order'))) +
    '<br>비교 화면 배치: ' + esc(valText(one('compare_layout'))) +
    (extra && extra.test ? '<br><b>※ 테스트 메일</b>' : '') + '</p>';
  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,\'Noto Sans KR\',sans-serif;max-width:640px;margin:auto">' +
    '<h2>UT 설문 응답</h2>' + meta + block('before') + block('after') + cmp + '</div>';
  return {
    subject: '[UT 응답] ' + built.pid.slice(0, 8) + ' · ' + kst(new Date()),
    html
  };
}

async function sendMail(env, built, extra) {
  if (!env.NAVER_SMTP_USER || !env.NAVER_SMTP_PASS) {
    console.warn('[survey] NAVER_SMTP_USER / NAVER_SMTP_PASS 없음 → 메일 발송 건너뜀');
    return 'skipped';
  }
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch (e) {
    console.warn('[survey] nodemailer 미설치 → 메일 발송 건너뜀 (npm install 필요)');
    return 'skipped';
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.naver.com', port: 465, secure: true,
    auth: { user: env.NAVER_SMTP_USER, pass: env.NAVER_SMTP_PASS }
  });
  const mail = buildMail(built, extra);
  const to = env.MAIL_TO || env.NAVER_SMTP_USER;
  let lastErr;
  for (let i = 0; i < 3; i++) { // 최초 1회 + 재시도 최대 2회
    try {
      await transporter.sendMail({ from: env.NAVER_SMTP_USER, to, subject: mail.subject, html: mail.html });
      return 'sent';
    } catch (e) {
      lastErr = e;
      console.warn('[survey] 메일 발송 실패(' + (i + 1) + '/3):', e.message);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  console.warn('[survey] 메일 최종 실패:', lastErr && lastErr.message);
  return 'failed';
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

  let mail_status = 'skipped';
  try { mail_status = await sendMail(env, built); }
  catch (e) { console.warn('[survey] 메일 처리 예외:', e.message); mail_status = 'failed'; }
  await setMailStatus(env, built.pid, mail_status, saved.where);
  return { status: 200, json: { ok: true, mail_status, stored: saved.where } };
}

module.exports = { handleSubmit, buildRows, buildMail, sendMail, esc };
