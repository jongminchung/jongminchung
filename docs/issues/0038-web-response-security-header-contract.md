# Issue 0038: Web 응답 보안 헤더와 배포 소유권 정리

- 상태: 진행 중
- 우선순위: P2
- 기준일: 2026-08-20
- 영향 범위:
  [Next configuration](../../apps/web/next.config.ts),
  [multi-site proxy](../../apps/web/proxy.ts),
  [root layout scripts](../../apps/web/app/root-layout.tsx),
  [deployment contract](../../apps/web/DEPLOYMENT.md),
  [Web workflow](../../.github/workflows/web.yml)

## 핵심 요약

- **저장소의 HTML 응답에는 framing·MIME sniffing·referrer·browser permission을 제한하는 명시적 보안 헤더 계약이 없음**
- **로컬 production 응답은 `X-Powered-By: Next.js`를 노출하고 주요 방어 헤더를 제공하지 않음**
- **Ingress가 별도 저장소에 있어 production edge가 헤더를 소유할 가능성은 있지만 현재 `DEPLOYMENT.md`와 smoke test에서 확인할 수 없음**
- **저위험 정적 헤더와 CSP를 분리하고 Home·Tech·Invest의 실제 inline script 요구를 기준으로 단계적으로 적용해야 함**
- **Cache Components와 정적 응답을 포기하지 않고 application·Ingress 중 한 곳을 canonical owner로 정해야 함**

## 현재 문제와 근거

- **application configuration에 공통 response header 정책이 없음**
  - `next.config.ts`에 `headers`와 `poweredByHeader` 설정이 없음
  - `proxy.ts`는 locale·rewrite·cache 관련 header만 설정함
  - local production HTML은 `X-Powered-By: Next.js`를 제공함
- **배포 문서가 security header owner를 정의하지 않음**
  - `DEPLOYMENT.md`는 Host 보존·standalone container·health probe 계약을 설명함
  - Ingress manifest는 외부 저장소가 소유하지만 CSP·frame policy·HSTS의 책임 위치는 명시하지 않음
  - CI와 E2E는 locale·routing·accessibility를 검사하지만 response security header를 검사하지 않음
- **CSP는 단순한 정적 문자열로 추가하기 어려움**
  - 초기 theme script와 Tech의 Excalidraw asset path script가 inline으로 실행됨
  - Next가 RSC bootstrap과 hydration을 위한 inline script를 생성함
  - nonce 기반 정책이 dynamic rendering을 요구하면 현재 Cache Components·prerender 계약에 영향을 줄 수 있음

## 채택할 내용

- **먼저 application과 production edge의 실제 header inventory를 작성함**
  - Home·Tech·Invest HTML
  - RSS·search index·OG image 같은 non-HTML response
  - local standalone과 production Ingress 결과 차이
- **정적 방어 헤더를 명확한 owner 한 곳에서 제공함**
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - 사용하지 않는 camera·microphone·geolocation 등을 제한하는 `Permissions-Policy`
  - CSP `frame-ancestors` 또는 호환 가능한 framing 방어
  - `poweredByHeader: false`
- **CSP는 report-only와 enforce 단계를 분리함**
  - 실제 script·style·font·image·connect source inventory를 먼저 수집함
  - inline script hash·nonce·framework 지원 경로를 Cache Components와 함께 비교함
  - violation report와 browser regression 확인 뒤 enforce 여부를 결정함
- **TLS termination에 의존하는 HSTS는 Ingress owner와 preload 조건을 확인한 뒤 별도로 결정함**

## 채택하지 않을 내용

- **production Ingress 확인 없이 application과 edge에서 같은 헤더를 중복 설정하지 않음**
- **동작 확인 없이 `script-src 'unsafe-inline'`을 최종 CSP로 고정하지 않음**
- **nonce 도입을 위해 모든 route를 동적 렌더링으로 전환하지 않음**
- **HSTS preload를 local Next configuration만으로 선언하지 않음**
- **정적 콘텐츠 사이트에 존재하지 않는 인증·세션·API 보안 범위를 추가하지 않음**

## 실행 작업

- **세 public domain과 local standalone의 response header inventory를 기록함**
- **application 또는 Ingress 중 canonical owner를 `DEPLOYMENT.md`에 명시함**
- **저위험 정적 헤더와 framework 노출 제거를 먼저 적용함**
- **Home·Tech·Invest와 non-HTML route의 header contract test를 추가함**
- **CSP report-only pilot에서 inline script와 lazy Excalidraw 경로를 검증함**
- **cache·prerender·browser 동작 변화가 없는지 production build와 E2E로 확인함**

## 완료 조건

- **공개 HTML 응답의 security header owner와 값이 저장소 문서에서 식별됨**
- **Home·Tech·Invest가 합의한 nosniff·referrer·permissions·framing 정책을 제공함**
- **`X-Powered-By`가 공개 HTML 응답에서 제거됨**
- **CSP를 enforce하지 않는 경우 report-only 결과와 보류 이유·재개 조건이 기록됨**
- **header 적용 뒤 Cache Components·static asset·RSS·검색·OG·Excalidraw 동작이 유지됨**

## 검증

- `pnpm --filter @jongminchung/web run typecheck`
- `pnpm --filter @jongminchung/web run test`
- `pnpm --filter @jongminchung/web run build`
- Home·Tech·Invest response header focused test
- production domain header smoke
- `pnpm --filter @jongminchung/web run test:e2e`
- `git diff --check`
