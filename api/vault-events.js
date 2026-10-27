// Vercel API route: POST /api/vault-events (보관함 테스트 행동 이벤트 기록)
//                    GET  /api/vault-events (A/B 체험 인원 수 — index.html 참여자 수 표시·버튼 잠금용)
const { handleVaultEvents, getVaultCounts } = require('../lib/vault-events.js');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const counts = await getVaultCounts(process.env);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify({ ok: true, counts }));
    } catch (e) {
      console.error('[vault-events] 집계 실패:', e.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: false, error: 'count_failed' }));
    }
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const out = await handleVaultEvents(body, process.env);
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out.json));
};
