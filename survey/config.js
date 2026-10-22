/*
 * its 보관함 비교 테스트 설문 설정 (브라우저와 서버가 함께 사용)
 * - LABELS: 설문 화면/메일에 표시되는 방식 이름. 사용자에게는 B/C를 알리지 않고 방식 이름(보관-비우기/모으기-비우기)으로만 부른다.
 * - MAPPING: 내부 기록용. 1 = c, 2 = b
 * - 비밀 키(Supabase service role, SMTP 계정)는 이 파일에 넣지 마세요. .env.local 에만 둡니다.
 */
(function (root, factory) {
  var cfg = factory();
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else root.SURVEY_CONFIG = cfg;
})(typeof self !== 'undefined' ? self : this, function () {
  var LABELS = { '1': '보관-비우기', '2': '모으기-비우기' };

  return {
    LABELS: LABELS,
    // 내부 기록용: 1(위, 보관-비우기) = c안, 2(아래, 모으기-비우기) = b안. 순서는 고정(섞지 않음)
    MAPPING: { '1': 'c', '2': 'b' },
    STORAGE_KEY: 'its_vault_survey_v2',
    PID_KEY: 'its_vault_pid',
    // index.html 이 남기는 값 (읽기 전용으로만 사용)
    DONE_KEYS: { '1': 'its_vault_done_1', '2': 'its_vault_done_2' },
    // 젤리아이 응답과 섞이지 않도록 별도 테이블 사용 (서버: lib/submit.js)
    SUBMIT_URL: 'api/submit',
    MAIL_TAG: '[its 보관함 테스트]',

    TASK: '모으기 → 찾아서 훑어보기',
    FEEDBACK: [
      ['feel', '느낀 점'],
      ['better', '바뀌어서 더 좋아진 점'],
      ['improve', '개선이 필요해 보이는 점'],
      ['expect', '기대되는 부분']
    ],

    TEXT: {
      priorUse: "테스트 전에도 '지금 여기 트렌드는'에서 '모으기' 기능을 사용해보신 적 있으신가요?",
      priorYes: '예',
      priorNo: '아니요',
      taskTitle: '과제를 해보셨나요?',
      taskSub: '방식마다 성공했는지, 포기했는지 눌러주세요.',
      taskSuccess: '성공',
      taskGiveUp: '포기',
      seq: '이 방식이 얼마나 쉬웠나요?',
      seqLow: '매우 어려웠다',
      seqHigh: '매우 쉬웠다',
      feedbackTitle: '각 방식에 대한 생각을 적어주세요.',
      feedbackSub: '선택 입력이에요. 비워두고 다음으로 넘어가도 괜찮아요.',
      comparePrefer: '두 방식 중 선호도가 더 높은 쪽은?',
      compareFamiliar: '두 방식 중 더 익숙하게 느껴진 쪽은?',
      cmpOne: '보관-비우기',
      cmpTwo: '모으기-비우기',
      cmpSame: '비슷함',
      finalTitle: '마지막 질문이에요',
      pickReason: '둘 중 하나만 계속 써야 한다면 어느 쪽을 쓰시겠어요? 그 이유도 알려주세요.'
    }
  };
});
