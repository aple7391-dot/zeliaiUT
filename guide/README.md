# its 온보딩 가이드 연결 방법

`guide/its-guide.js` 는 its 사이트 DOM 위에 안내 오버레이를 얹는 스크립트입니다. 주소에 `guide=1` 이 있을 때만 동작합니다.
its 는 `X-Frame-Options: SAMEORIGIN` 이라 iframe 래퍼를 쓸 수 없고 다른 도메인 DOM 도 읽을 수 없어서, its 쪽에서 불러와야 합니다.

its 저장소 `vault-guide` 브랜치에 반영되어 있습니다.

- `app/layout.tsx` 의 `<Analytics />` 바로 아래(40번째 줄): `guide=1` 일 때만 `/vault-guide.js` 를 불러오는 인라인 `<Script>` 한 줄
- `public/vault-guide.js`: 이 폴더의 `its-guide.js` 와 같은 파일 (스크립트가 공개 접근 가능한 같은 도메인에서 나가도록 its 쪽에 둠)
- `components/` 는 수정하지 않음. `guide=1` 이 없는 일반 방문자는 추가 요청도 화면 변화도 없음.

가이드 문구/타이밍을 바꾸면 `its-guide.js` 를 고친 뒤 its 의 `public/vault-guide.js` 에 같은 내용을 복사하세요.
