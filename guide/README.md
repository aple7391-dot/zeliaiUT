# its 온보딩 가이드 연결 방법

`guide/its-guide.js` 는 its 사이트 DOM 위에 안내 오버레이를 얹는 스크립트입니다. 주소에 `guide=1` 이 있을 때만 동작합니다.

its 사이트는 `X-Frame-Options: SAMEORIGIN` 이라 이 테스트 사이트가 iframe 으로 감쌀 수 없고, 다른 도메인의 DOM 은 읽을 수 없습니다.
따라서 its 쪽에서 이 스크립트를 한 번 불러와야 합니다. (its 코드 수정이 필요한 유일한 부분)

its `app/layout.tsx` 의 `<body>` 안에 한 줄 (테스트 사이트 주소는 실제 배포 주소로):

```tsx
<Script id="vault-guide" strategy="afterInteractive">{`if(location.search.indexOf('guide=1')>-1){var s=document.createElement('script');s.src='https://<테스트 사이트 도메인>/guide/its-guide.js';document.head.appendChild(s)}`}</Script>
```

`guide=1` 이 없는 일반 방문자에게는 아무 영향이 없습니다.
