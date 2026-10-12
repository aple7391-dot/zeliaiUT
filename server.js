// 로컬 실행/자체 서버용: 정적 파일 + POST /api/submit
// 실행: npm start  →  http://localhost:3000
require('./lib/env.js').loadEnv();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleSubmit } = require('./lib/submit.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json'
};
// 서버 코드/비밀/데이터는 절대 정적으로 내보내지 않음
const BLOCK = /^\/(lib|api|scripts|data|supabase|node_modules|public:assets)(\/|$)|^\/(\.|server\.js|package(-lock)?\.json)/;

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}

http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/api/submit') {
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    const out = await handleSubmit(await readBody(req), process.env);
    res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(out.json));
  }
  let rel = url === '/' ? '/index.html' : url;
  if (BLOCK.test(rel) || rel.includes('..')) { res.writeHead(404); return res.end('Not found'); }
  const file = path.join(ROOT, rel);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('http://localhost:' + PORT));
