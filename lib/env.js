// .env.local 을 process.env 로 읽어오는 작은 로더 (의존성 없음)
const fs = require('fs');
const path = require('path');
function loadEnv(file) {
  const p = file || path.join(__dirname, '..', '.env.local');
  let txt = '';
  try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
  txt.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
}
module.exports = { loadEnv };
