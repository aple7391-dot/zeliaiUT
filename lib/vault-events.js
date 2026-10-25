/*
 * 보관함 비교 테스트 행동 기록 (POST /api/vault-events)
 * 저장: Supabase vault_events 테이블 → 환경변수가 없으면 data/vault_events.jsonl
 */
const fs = require('fs');
const path = require('path');
const { sb, hasSupabase } = require('./submit.js');

const LOCAL_FILE = path.join(__dirname, '..', 'data', 'vault_events.jsonl');
const TYPES = new Set(['page_view', 'open_its', 'its_done', 'survey_click', 'survey_step']);
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

module.exports = { handleVaultEvents, build };
