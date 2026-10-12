// npm run test-mail : 더미 응답 1건으로 메일 발송만 테스트 (DB 저장 안 함)
require('../lib/env.js').loadEnv();
const crypto = require('crypto');
const { buildRows, sendMail } = require('../lib/submit.js');

const built = buildRows({
  participant_id: crypto.randomUUID(),
  first_version: null,
  first_impression_order: ['after', 'before'],
  compare_layout: 'after_left',
  task_result: { before: { result: 'success' }, after: { result: 'giveup' } },
  answers: {
    seq_before: 3, seq_after: 6,
    open_before: '모델 선택 메뉴를 찾기 어려웠어요.\n조금 당황했습니다. <b>테스트</b>',
    open_after: '바로 보여서 편했어요.',
    imp_before: 'AI 음성 비서', imp_after: 'AI 포털 서비스',
    compare_choice: 'after', compare_reason: '입력창이 바로 보여서',
    intent_before: 3, intent_after: 6,
    intent_open_before: '쓰고 싶지 않아요', intent_open_after: '검색할 때 쓰고 싶어요'
  }
});
sendMail(process.env, built, { test: true }).then((s) => {
  console.log('mail_status =', s);
  if (s === 'skipped') console.log('→ .env.local 에 NAVER_SMTP_USER / NAVER_SMTP_PASS 를 채우고 npm install 후 다시 실행하세요.');
  process.exit(s === 'sent' || s === 'skipped' ? 0 : 1);
});
