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

## 현재 상태 — 2026-09-06 작업 트리

- **`next.config.ts`의 `headers()`가 `/(.*)`에 정적 방어 헤더 4개를 설정함**

| 헤더                     | 설정값                                     |
| ------------------------ | ------------------------------------------ |
| `X-Content-Type-Options` | `nosniff`                                  |
| `X-Frame-Options`        | `SAMEORIGIN`                               |
| `Referrer-Policy`        | `strict-origin-when-cross-origin`          |
| `Permissions-Policy`     | `camera=(), geolocation=(), microphone=()` |

- **`poweredByHeader: false`를 명시하고 application을 정적 방어 헤더의 canonical owner로 `DEPLOYMENT.md`에 기록함**
- **2026-09-06 공개 세 사이트 `/ko`는 200과 네 헤더를 제공하며 `X-Powered-By`·CSP·Report-Only는 관찰되지 않음**
- **HTML·RSS·검색·OG·robots·sitemap 응답 회귀 검사를 추가함**
- **CSP pilot은 보고 수집 위치·보존 정책·운영 담당자와 browser source inventory 확보 후 재개함. 배포 대시보드 override의 실제 구성은 별도 운영 확인 대상임**

## 최초 문제와 근거 — 2026-08-20

- 당시 application configuration에 `headers`와 `poweredByHeader` 설정이 없었음
- 당시 local production HTML에서 `X-Powered-By: Next.js`를 관찰했고 주요 방어 헤더는 없었음
- 배포 문서와 smoke test에서 production edge의 보안 헤더 책임을 확인할 수 없었음

## CSP 검토가 남은 이유

- 초기 theme script·Tech Excalidraw asset path script와 Next RSC bootstrap·hydration script가 inline으로 실행됨
- nonce 기반 정책이 dynamic rendering을 요구하면 Cache Components·prerender 계약에 영향을 줄 수 있음
- 실제 source inventory와 report-only 결과를 확인한 뒤 enforce 여부를 결정해야 함

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

## 실행 작업과 남은 범위

- **세 public domain과 local standalone의 response header inventory를 기록함**
- **application 또는 Ingress 중 canonical owner를 `DEPLOYMENT.md`에 명시함**
- [x] application의 정적 방어 헤더 4개를 설정함
- [x] `poweredByHeader: false`로 framework 노출을 제거하고 실제 응답을 검증함
- **Home·Tech·Invest와 non-HTML route의 header contract test를 추가함**
- **CSP report-only pilot에서 inline script와 lazy Excalidraw 경로를 검증함**
- **cache·prerender·browser 동작 변화가 없는지 production build와 E2E로 확인함**

## 완료 조건

- **공개 HTML 응답의 security header owner와 값이 저장소 문서에서 식별됨**
- **Home·Tech·Invest가 합의한 nosniff·referrer·permissions·framing 정책을 제공함**
- **`X-Powered-By`가 공개 HTML 응답에서 제거됨**
- **CSP를 enforce하지 않는 경우 report-only 결과와 보류 이유·재개 조건이 기록됨**
- **header 적용 뒤 Cache Components·static asset·RSS·검색·OG·Excalidraw 동작이 유지됨**

## 현재 재검증

- `bun run --filter @jongminchung/web typecheck`
- `bun run --filter @jongminchung/web test`
- `bun run --filter @jongminchung/web build`
- Home·Tech·Invest response header focused test
- production domain header smoke
- `bun run --filter @jongminchung/web test:e2e`
- `git diff --check`

## 2026-09-06 로컬 검증 결과

- production build와 `bun run check` 통과.
- 세 사이트 HTML·RSS·검색·OG·robots·sitemap의 보안 헤더 응답 검사 12건 통과.
- 전체 E2E 133건 중 최초 130건 통과. 모바일 2건은 전체 load 대기를 DOMContentLoaded와 화면 assertion으로 바꾼 뒤 통과.
- 시각 회귀 1건은 이미지 로드 실패가 관찰되었고 원본·최적화 이미지 200 확인 후 재검증에서 통과. snapshot은 변경하지 않음.
- 초기 `links:check`는 Docker 미설치로 실행하지 못했으나, Podman 우선·Docker 대체 실행을 지원한 뒤 전체 검사에서 670개 링크·오류 0건을 확인함.
