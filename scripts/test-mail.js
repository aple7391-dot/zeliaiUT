// npm run test-mail : 더미 응답 1건으로 메일 발송만 테스트 (DB 저장 안 함)
require('../lib/env.js').loadEnv();
const crypto = require('crypto');
const { buildRows, sendMail } = require('../lib/submit.js');

const built = buildRows({
  participant_id: crypto.randomUUID(),
  prior_use: '아니요',
  order: '1then2',
  device_type: 'mobile',
  answers: {
    seq_1: 6, seq_2: 3,
    fb_feel_1: '보관함이 편했어요', fb_improve_2: '삭제 버튼 위치가 헷갈렸어요',
    compare_prefer: '보관함', compare_familiar: '비슷함', final_pick_reason: '보관함, 모으기가 빨라서'
  }
});
console.log('subject =', require('../lib/submit.js').buildMail(built).subject);
sendMail(process.env, built, { test: true }).then((r) => {
  console.log('mail_status =', r.status, r.detail ? '(' + r.detail + ')' : '');
  process.exit(r.status === 'sent' || r.status === 'skipped' ? 0 : 1);
});
