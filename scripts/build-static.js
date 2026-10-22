// Vercel 빌드용: 사이트 루트가 public/ 이므로 정적 파일을 public/ 으로 복사한다.
// (소스는 프로젝트 루트에 그대로 두고, 생성물은 git에 올리지 않는다)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');

function copyFile(rel, transform) {
  const src = path.join(ROOT, rel);
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (transform) fs.writeFileSync(dst, transform(fs.readFileSync(src, 'utf8')));
  else fs.copyFileSync(src, dst);
}
function copyDir(rel) {
  const src = path.join(ROOT, rel);
  fs.readdirSync(src, { withFileTypes: true }).forEach((e) => {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) copyDir(r);
    else copyFile(r);
  });
}

['index.html', 'survey.html'].forEach((f) => copyFile(f));
copyFile(path.join('survey', 'config.js'));
console.log('static files copied to public/');
