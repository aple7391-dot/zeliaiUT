// GET /api/config : 브라우저 추적 코드가 쓰는 공개 설정 (믹스패널 프로젝트 토큰은 저장소에 두지 않고 환경변수로 전달)
module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(JSON.stringify({
    mp_token: String(process.env.MIXPANEL_TOKEN || '').trim() || null,
    // 데이터 거주 지역이 EU 면 api-eu.mixpanel.com, 인도는 api-in.mixpanel.com
    mp_host: String(process.env.MIXPANEL_API_HOST || 'api.mixpanel.com').trim()
  }));
};
