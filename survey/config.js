/*
 * 설문 설정 (브라우저와 서버가 함께 사용)
 * - LABELS: 설문 화면/메일에 표시되는 버전 이름. 여기 한 곳에서만 바꾸세요.
 * - 비밀 키(Supabase service role, SMTP 계정)는 이 파일에 넣지 마세요. .env.local 에만 둡니다.
 */
(function (root, factory) {
  var cfg = factory();
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else root.SURVEY_CONFIG = cfg;
})(typeof self !== 'undefined' ? self : this, function () {
  var LABELS = { before: '개선 전', after: '개선 후' };

  return {
    LABELS: LABELS,
    STORAGE_KEY: 'zeli_survey_v1',
    // 기존 UT 화면이 남기는 값 (읽기 전용으로만 사용)
    EXISTING_KEYS: {
      result: { before: 'zeli_result_before', after: 'zeli_result_after' }
    },
    // 서버가 존재하지 않는 환경(정적 호스팅)에서도 같은 경로로 호출
    SUBMIT_URL: 'api/submit',

    IMAGES: {
      start: { before: 'public/assets/start_asis.jpg', after: 'public/assets/start_tobe.png' },
      chat: { before: 'public/assets/chat_asis.jpg', after: 'public/assets/chat_tobe.png' }
    },
    // 원본 가로/세로(px): 이미지가 오기 전에 자리를 미리 잡는 데 사용
    SIZES: {
      start: { before: [1080, 2394], after: [780, 1525] },
      chat: { before: [1080, 2394], after: [780, 1525] }
    },
    ALT: {
      start: { before: LABELS.before + ' 시작 화면', after: LABELS.after + ' 시작 화면' },
      chat: { before: LABELS.before + ' 채팅 화면', after: LABELS.after + ' 채팅 화면' }
    },

    TEXT: {
      seq: '모델 선택하고 대화 시작하기는 난이도가 어땠나요?',
      seqLow: '매우 어려움',
      seqHigh: '매우 쉬움',
      experienceTitle: '찾는 과정에서 예상과 달랐던 점이 있었나요? 느꼈던 감정도 편하게 적어주세요.',
      reviewImage: '이미지 다시보기',
      firstImpression: '이 화면을 처음 봤을 때 어떤 서비스라고 생각했어요?',
      compareChoice: '어느 쪽이 대화를 시작하기 더 쉬웠나요?',
      compareSame: '차이 없음',
      compareReason: '그렇게 생각한 이유는?',
      // {label} 자리에 LABELS(개선 전/개선 후)가 들어갑니다
      intent: '{label}의 서비스를 다시 사용할 의향이 있나요?',
      intentLow: '전혀 없음',
      intentHigh: '매우 있음',
      intentReason: '어떤 상황에서 다시 쓰고 싶으신가요? 쓰고 싶지 않다면 이유는?'
    }
  };
});
