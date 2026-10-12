/*
 * UT 행동 이벤트 수집 (POST /api/events)
 * 저장: Supabase events 테이블 → 환경변수 없으면 data/events.jsonl
 */
const fs = require('fs');
const path = require('path');
const { sb, hasSupabase } = require('./submit.js');

const LOCAL_FILE = path.join(__dirname, '..', 'data', 'events.jsonl');
const TYPES = new Set(['start', 'click', 'view', 'result', 'hidden']);
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
const str = (v, n) => (v === undefined || v === null ? null : String(v).slice(0, n));

function build(body) {
  const pid = String(body.participant_id || '');
  const sid = String(body.session_id || '');
  const variant = body.variant;
  if (!/^[0-9a-fA-F-]{16,64}$/.test(pid)) throw new Error('invalid participant_id');
  if (!/^[0-9a-fA-F-]{16,64}$/.test(sid)) throw new Error('invalid session_id');
  if (variant !== 'before' && variant !== 'after') throw new Error('invalid variant');
  const evs = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
  const now = new Date().toISOString();
  return evs.filter((e) => e && TYPES.has(e.type)).map((e) => ({
    participant_id: pid, session_id: sid, variant,
    seq: num(e.seq), type: e.type, t_ms: num(e.t),
    screen: str(e.screen, 40), overlay: str(e.overlay, 40), tab: str(e.tab, 20),
    target: str(e.target, 60), label: str(e.label, 40),
    x: num(e.x), y: num(e.y),
    extra: (e.type === 'result' || e.type === 'start')
      ? { result: str(e.result, 10), elapsed_ms: num(e.elapsed_ms), w: num(e.w), h: num(e.h), data: str(e.data, 40) }
      : (e.data ? { data: str(e.data, 40) } : null),
    created_at: now
  }));
}

async function handleEvents(body, env) {
  env = env || process.env;
  let rows;
  try { rows = build(body || {}); } catch (e) { return { status: 400, json: { ok: false, error: e.message } }; }
  if (!rows.length) return { status: 200, json: { ok: true, stored: 0 } };
  try {
    if (hasSupabase(env)) {
      // (session_id, seq) 가 같은 이벤트가 재전송되면 무시
      const r = await sb(env, 'POST', 'events?on_conflict=session_id,seq', rows,
        { Prefer: 'return=minimal,resolution=ignore-duplicates' });
      if (!r.ok) throw new Error('supabase events ' + r.status + ' ' + (await r.text()));
    } else {
      fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
      fs.appendFileSync(LOCAL_FILE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }
  } catch (e) {
    console.error('[events] 저장 실패:', e.message);
    return { status: 500, json: { ok: false, error: 'save_failed' } };
  }
  return { status: 200, json: { ok: true, stored: rows.length } };
}

module.exports = { handleEvents, build };
