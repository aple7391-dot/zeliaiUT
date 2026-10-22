/*
 * its 보관함 비교 테스트 설문 설정 (브라우저와 서버가 함께 사용)
 * - LABELS: 설문 화면/메일에 표시되는 방식 이름. 사용자에게는 "모으기"/"보관함"만 알리면 된다(긴 조합 표현은 쓰지 않는다).
 * - MAPPING: 내부 기록용. 1 = c(보관함), 2 = b(모으기)
 * - 비밀 키(Supabase service role, SMTP 계정)는 이 파일에 넣지 마세요. .env.local 에만 둡니다.
 */
(function (root, factory) {
  var cfg = factory();
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else root.SURVEY_CONFIG = cfg;
})(typeof self !== 'undefined' ? self : this, function () {
  var LABELS = { '1': '보관함', '2': '모으기' };

  return {
    LABELS: LABELS,
    // 내부 기록용: 1(보관함) = c안, 2(모으기) = b안. 순서는 고정(섞지 않음)
    MAPPING: { '1': 'c', '2': 'b' },
    STORAGE_KEY: 'its_vault_survey_v3',
    PID_KEY: 'its_vault_pid',
    // index.html 이 남기는 값 (읽기 전용으로만 사용)
    DONE_KEYS: { '1': 'its_vault_done_1', '2': 'its_vault_done_2' },
    // 젤리아이 응답과 섞이지 않도록 별도 테이블 사용 (서버: lib/submit.js)
    SUBMIT_URL: 'api/submit',
    MAIL_TAG: '[its 보관함 테스트]',

    // 보관함/모으기 각 방식 화면에서: 쉬웠는가(척도) + 느낀 점 + 개선이 필요해 보이는 점, 3문항만 묻는다
    FEEDBACK: [
      ['feel', '느낀 점'],
      ['improve', '개선이 필요해 보이는 점']
    ],
    // 비워둬도 되는 텍스트 입력칸에, 어떤 식으로 적으면 되는지 보여주는 예시(placeholder)
    FEEDBACK_PH: {
      c: { feel: '보관함으로 분리되어 깔끔하게 볼 수 있는 장점이 있어요.', improve: '담은 카드가 많아지면 보관함 안에서 찾기가 어려울 것 같아요.' },
      b: { feel: '카드를 바로 눌러서 모을 수 있어서 빠르고 편했어요.', improve: '모은 카드가 몇 개인지 한눈에 보이면 더 좋을 것 같아요.' }
    },
    IMG: {
      prior: 'img/survey_q1.png',
      c: 'img/survey_c.png',
      b: 'img/survey_b.png'
    },

    TEXT: {
      priorTitle1: '지금 해보신 테스트 전에도',
      priorTitle2: "'모으기' 기능을 사용해보신 적 있으신가요?",
      priorYes: '예',
      priorNo: '아니요',
      seq: '이 방식이 얼마나 쉬웠나요?',
      seqLow: '매우 어려웠다',
      seqHigh: '매우 쉬웠다',
      stepTitle: { c: '보관함 방식은 어땠나요?', b: '모으기 방식은 어땠나요?' },
      comparePrefer: '두 방식 중 선호도가 더 높은 쪽은?',
      compareFamiliar: '두 방식 중 더 익숙하게 느껴진 쪽은?',
      cmpOne: '보관함',
      cmpTwo: '모으기',
      finalTitle: '마지막 질문이에요',
      pickReason: '둘 중 하나만 계속 써야 한다면 어느 쪽을 쓰시겠어요? 그 이유도 알려주세요.'
    }
  };
});
