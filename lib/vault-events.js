/*
 * 보관함 비교 테스트 행동 기록 (POST /api/vault-events)
 * 저장: Supabase vault_events 테이블 → 환경변수가 없으면 data/vault_events.jsonl
 */
const fs = require('fs');
const path = require('path');
const { sb, hasSupabase } = require('./submit.js');

const LOCAL_FILE = path.join(__dirname, '..', 'data', 'vault_events.jsonl');
// funnel: its 미션 퍼널 단계(index.html 이 its 탭에서 받아 전달). extra 에 step·test·elapsed_ms·step_ms·round
const TYPES = new Set(['page_view', 'open_its', 'its_done', 'survey_click', 'survey_step', 'funnel']);
const UUID = /^[0-9a-fA-F-]{16,64}$/;
const str = (v, n) => (v === undefined || v === null ? null : String(v).slice(0, n));

function build(body) {
  const pid = String(body.participant_id || '');
  if (!UUID.test(pid)) throw new Error('invalid participant_id');
  const evs = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
  return evs.filter((e) => e && TYPES.has(e.type) && UUID.test(String(e.id || ''))).map((e) => {
    const t = new Date(Number(e.t));
    return {
      id: String(e.id), participant_id: pid, page: str(e.page, 20), type: e.type,
      variant: e.variant === '1' || e.variant === '2' ? e.variant : null,
      client_ts: Number.isFinite(t.getTime()) ? t.toISOString() : null,
      extra: e.extra && typeof e.extra === 'object' ? e.extra : null,
      created_at: new Date().toISOString()
    };
  });
}

async function handleVaultEvents(body, env) {
  env = env || process.env;
  let rows;
  try { rows = build(body || {}); } catch (e) { return { status: 400, json: { ok: false, error: e.message } }; }
  if (!rows.length) return { status: 200, json: { ok: true, stored: 0 } };
  try {
    if (hasSupabase(env)) {
      const r = await sb(env, 'POST', 'vault_events?on_conflict=id', rows,
        { Prefer: 'return=minimal,resolution=ignore-duplicates' });
      if (!r.ok) throw new Error('supabase vault_events ' + r.status + ' ' + (await r.text()));
    } else {
      fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
      fs.appendFileSync(LOCAL_FILE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }
  } catch (e) {
    console.error('[vault-events] 저장 실패:', e.message);
    return { status: 500, json: { ok: false, error: 'save_failed' } };
  }
  return { status: 200, json: { ok: true, stored: rows.length } };
}

/*
 * GET /api/vault-counts — index.html 의 "N명이 참여했어요" 표시 + 한쪽이 5명 앞서면
 * 반대쪽만 체험하도록 버튼을 잠그는 로직에 쓰는, 체험(open_its)한 참여자 수.
 * 같은 참여자가 같은 쪽을 여러 번 눌러도 한 명으로 센다(participant_id 기준 distinct).
 */
async function getVaultCounts(env) {
  env = env || process.env;
  let rows;
  if (hasSupabase(env)) {
    const r = await sb(env, 'GET', 'vault_events?select=participant_id,variant&type=eq.open_its&variant=not.is.null');
    if (!r.ok) throw new Error('supabase vault_events(count) ' + r.status + ' ' + (await r.text()));
    rows = await r.json();
  } else {
    rows = localRead().filter((r) => r.type === 'open_its' && (r.variant === '1' || r.variant === '2'));
  }
  const seen = { '1': new Set(), '2': new Set() };
  for (const r of rows) {
    if (r.participant_id && (r.variant === '1' || r.variant === '2')) seen[r.variant].add(r.participant_id);
  }
  // 1 = B 테스트(c안), 2 = A 테스트(b안) — index.html 의 opt 데이터셋(data-n)과 같은 번호
  return { a: seen['2'].size, b: seen['1'].size };
}

function localRead() {
  try {
    return fs.readFileSync(LOCAL_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (e) { return []; }
}

module.exports = { handleVaultEvents, getVaultCounts, build };
