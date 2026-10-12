// Vercel API route: POST /api/events (UT 행동 이벤트)
const { handleEvents } = require('../lib/events.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const out = await handleEvents(body, process.env);
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out.json));
};
