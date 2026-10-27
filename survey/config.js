/*
 * its 모으기 A/B 테스트 설문 설정 (브라우저와 서버가 함께 사용)
 * - LABELS: 설문 화면/메일에 표시되는 방식 이름. 참가자에게는 A/B 로만 알린다(내부 구현 차이는 드러내지 않는다).
 * - MAPPING: 내부 기록용. 1 = c(= 참가자 화면의 B), 2 = b(= 참가자 화면의 A). 지난 회차의 B→A, C→B 리네이밍을 반영.
 * - 비밀 키(Supabase service role, SMTP 계정)는 이 파일에 넣지 마세요. .env.local 에만 둡니다.
 */
(function (root, factory) {
  var cfg = factory();
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else root.SURVEY_CONFIG = cfg;
})(typeof self !== 'undefined' ? self : this, function () {
  var LABELS = { '1': 'B', '2': 'A' };

  return {
    LABELS: LABELS,
    // 내부 기록용: 1 = c안(참가자 화면 B), 2 = b안(참가자 화면 A). 순서는 고정(섞지 않음)
    MAPPING: { '1': 'c', '2': 'b' },
    STORAGE_KEY: 'its_vault_survey_v5',
    PID_KEY: 'its_vault_pid',
    // index.html 이 남기는 값 (읽기 전용으로만 사용)
    DONE_KEYS: { '1': 'its_vault_done_1', '2': 'its_vault_done_2' },
    // 젤리아이 응답과 섞이지 않도록 별도 테이블 사용 (서버: lib/submit.js)
    SUBMIT_URL: 'api/submit',
    MAIL_TAG: '[its 모으기 A/B 테스트 3회차]',

    // 각 방식 화면에서: 쉬웠는가(척도) + 재인지(척도) + 느낀 점 + 개선이 필요해 보이는 점, 4문항만 묻는다
    FEEDBACK: [
      ['feel', '느낀 점'],
      ['improve', '개선이 필요해 보이는 점']
    ],
    // 비워둬도 되는 텍스트 입력칸의 예시(placeholder). A·B 설문은 사진 말고는 똑같아야 해서 예시도 같게 둔다.
    FEEDBACK_PH: {
      c: { feel: '자유롭게 적어주세요.', improve: '자유롭게 적어주세요.' },
      b: { feel: '자유롭게 적어주세요.', improve: '자유롭게 적어주세요.' }
    },
    IMG: {
      prior: 'img/survey_q1_v2.png',
      c: 'img/survey_c.png',
      b: 'img/survey_b.png'
    },

    TEXT: {
      variantBadge: '방금 테스트하신 방식은 {V} 입니다',
      priorTitle: "테스트 전에도 '모으기' 기능을\n사용해보신 적 있으신가요?", // \n 에서 줄바꿈
      priorYes: '네',
      priorNo: '아니오',
      seq: '이 방식이 얼마나 쉬웠나요?',
      seqLow: '매우 어려웠다',
      seqHigh: '매우 쉬웠다',
      // (3회차 변경) '리스트를 찾아 진입할 수 있었나요?'는 '쉬웠나요'와 겹쳐서 단답형 질문으로 바꿨다
      noCollect: '이 서비스에 모으기 기능이 없다면 어떨 것 같으세요?',
      noCollectPh: '짧게 적어주세요.',
      stepTitle: { c: '이 방식은 어땠나요?', b: '이 방식은 어땠나요?' },
      comparePrefer: '두 방식 중 선호도가 더 높은 쪽은?',
      compareFamiliar: '두 방식 중 더 익숙하게 느껴진 쪽은?',
      cmpOne: 'B',
      cmpTwo: 'A',
      finalTitle: '마지막 질문이에요',
      pickReason: '둘 중 하나만 계속 써야 한다면 어느 쪽을 쓰시겠어요? 그 이유도 알려주세요.',
      thanksTitle: '참여해 주셔서 감사합니다',
      contactLabel: '연락처를 남겨주시면 추첨을 통해 5천원 기프티콘으로 감사를 전하겠습니다.',
      contactPh: '010-0000-0000',
      contactNote: '연락처는 보관되지 않고, 기프티콘은 문자로 전달드립니다.'
    }
  };
});
