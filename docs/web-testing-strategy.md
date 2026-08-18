# Web 테스트 전략

- **`apps/web`의 테스트 목적은 구현을 고정하는 일이 아니라 공개 콘텐츠 계약과 사용자가 겪는 흐름의 회귀를 탐지하는 데 있음**
- **Vitest는 순수 규칙·생성물 계약·동기 컴포넌트 상태에 사용하고, production build를 거친 Playwright는 서버·브라우저 경계에 사용함**
- **다중 도메인 라우팅, locale, 검색, 콘텐츠 생성, 외부 다이어그램, 공개 discovery 파일은 사용자와 크롤러의 계약이므로 유지함**
- **정확한 콘텐츠 개수·특정 추천 목록·넓은 화면의 full-page snapshot은 제품 계약이 아닐 경우 축소하거나 일반화함**
- **자동 접근성 검사는 대표 상태에 유지하되, 키보드와 보조기기 사용성의 전부를 대체하지 않음**

## 공식 근거와 도구 경계

- **Vitest는 독립적으로 실행 가능한 함수, 동기 Server Component, Client Component의 규칙 검증에 사용함**
  - 근거: Next.js는 Vitest와 React Testing Library를 unit test 조합으로 안내하며, 동기 Server·Client Component는 단위 테스트할 수 있다고 설명함
  - 예외: `async` Server Component는 Vitest가 지원하지 않으므로 E2E test로 검증해야 함
  - 참고: [Next.js Vitest 가이드](https://nextjs.org/docs/pages/guides/testing/vitest)

- **Playwright는 production build에서 실제 HTTP 응답, hydration, browser API, 사용자 흐름을 검증하는 데 사용함**
  - 근거: Next.js는 실제 Next.js application을 대상으로 하는 Playwright E2E에는 서버가 필요하며, production code 대상으로 실행할 것을 권장함
  - 사례: `apps/web/playwright.config.ts`의 `pnpm run build` 후 `pnpm run start` 구성은 이 경계에 부합함
  - 참고: [Next.js Playwright 가이드](https://nextjs.org/docs/pages/guides/testing/playwright)

- **UI assertion은 role·label·visible result를 우선하고 implementation selector는 최후 수단으로 사용함**
  - 근거: Testing Library와 Playwright는 사용자에게 보이는 동작과 접근 가능한 locator를 권장함
  - 사례: 버튼은 CSS class가 아니라 `getByRole("button", { name })`로 찾음
  - 참고: [Testing Library 소개](https://testing-library.com/docs/), [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## 유지할 Vitest 테스트

- **콘텐츠 schema와 입력 검증 테스트는 유지함**
  - 근거: MDX frontmatter와 투자 노트는 build·검색·route가 공유하는 데이터 경계임
  - 대상: `apps/web/lib/content-model.test.ts`, `apps/web/lib/investment-content.test.ts`, `apps/web/lib/excalidraw-scene.test.ts`
  - 사례: 지원하지 않는 locale·field, 중복 tag·element ID, credential을 포함한 URL, 누락된 Excalidraw binary asset 거부가 해당함

- **결정 규칙과 안전 경계 테스트는 유지함**
  - 근거: 순수 함수의 결정성은 빠른 단위 테스트로 가장 명확하게 보장됨
  - 대상: `apps/web/lib/search.test.ts`, `apps/web/lib/documents.test.ts`, `apps/web/lib/site-routing.test.ts`, `apps/web/proxy.test.ts`
  - 사례: title 우선 검색, 관련 문서 fallback, `Accept-Language` 품질값 협상, private path·spoofed routing header 차단이 해당함

- **생성물과 원본의 일관성 테스트는 유지함**
  - 근거: 콘텐츠 원본, manifest, loader, search JSON의 불일치는 런타임에서 문서 누락·검색 실패로 나타남
  - 대상: `apps/web/scripts/content-contract.integration.test.ts`, `apps/web/scripts/check-excalidraw.test.ts`
  - 사례: 한글·영문 문서 쌍, heading ID, 내부 link, 생성물 stale 상태, manifest의 유일 ID 검증이 해당함
  - 예외: topic 수와 demo 수의 정확한 상수값은 콘텐츠 증감 자체를 실패로 만들므로 제거하고, 유일성·registry 일치·유효한 entry 검증만 유지함

- **서버 route와 query adapter의 공개 응답 계약 테스트는 유지함**
  - 근거: route·query adapter는 UI와 정적 산출물 사이의 작은 통합 경계임
  - 대상: `apps/web/app/llms-route.test.ts`, `apps/web/app/metadata-routes.test.ts`, `apps/web/lib/tech-queries.test.ts`, `apps/web/remark-plugins.test.ts`
  - 사례: sitemap·`llms.txt`, query cache key와 HTTP·Zod failure, Kroki 성공·오류 fallback 검증이 해당함

- **작은 client state 규칙 테스트는 유지함**
  - 근거: browser storage나 provider instance 분리는 E2E만으로 원인 위치를 좁히기 어려움
  - 대상: `apps/web/components/TechUiProvider.test.ts`
  - 사례: store instance 간 state 격리와 search lazy-open marker의 유지가 해당함

- **정적 홈 카피 검증은 공개 계약만 남김**
  - 대상: `apps/web/lib/home/content.test.ts`
  - 유지 사례: canonical person metadata, 필수 public destination, 중복이 허용되지 않는 식별자 검증이 해당함
  - 축소 사례: 단지 현재 문구나 임의 목록이 존재한다는 assertion은 콘텐츠 계약 통합 테스트로 흡수하거나 제거함

## 유지할 Playwright 테스트

- **Host·locale·보안 라우팅의 실제 HTTP 경계 테스트는 유지함**
  - 대상: `apps/web/proxy.e2e.test.ts`
  - 근거: unit test는 routing function을 검증하지만 실제 Host header, redirect, rewritten route, not-found response의 조합은 production server에서만 검증됨
  - 사례: unknown host와 private path 거부, `X-Forwarded-Host` 무시, cookie 우선 locale redirect, host와 무관한 health response가 해당함

- **기술 문서의 핵심 독자 흐름은 유지함**
  - 대상: `apps/web/app/(tech)/tech.e2e.test.ts`
  - 근거: search fetch, retry UI, history·hash link, diagram loading/failure, locale·theme persistence는 hydration·network·browser storage를 함께 사용함
  - 사례: 검색 결과에서 문서를 열고 locale을 바꿔도 같은 문서를 유지하는 흐름과, search index·remote diagram failure를 사용자에게 보이는 상태로 검증하는 일이 해당함

- **투자 사이트의 locale과 크롤러 공개 파일 테스트는 유지함**
  - 대상: `apps/web/app/(invest)/investment.e2e.test.ts`
  - 근거: 별도 domain의 locale cookie와 `robots.txt`·`sitemap`은 배포된 HTTP representation의 계약임
  - 사례: locale 선택 후 새 page에서도 유지되는지와 discovery 파일을 독립적으로 제공하는지 검증이 해당함

- **문서 탐색성과 외부 공개 자산의 실제 응답 테스트는 유지함**
  - 대상: `apps/web/app/(tech)/document-discovery.e2e.test.ts`, `apps/web/app/(tech)/document-language.e2e.test.ts`
  - 근거: outline active state와 server HTML language, OG image, `llms.txt`는 client·server·crawler가 서로 다르게 소비하는 경계임
  - 사례: scroll에 따른 `aria-current="location"`, locale-prefixed 404의 `lang`, PNG signature와 content type 검증이 해당함

- **대표 페이지의 자동 접근성·모션·모바일 overflow 검사는 유지함**
  - 대상: `apps/web/app/(home)/home.e2e.test.ts`
  - 근거: Playwright의 axe 연동은 label, contrast, duplicate ID 등 자동 탐지 가능한 회귀를 찾을 수 있음
  - 예외: axe는 모든 접근성 문제를 찾을 수 없으므로 navigation, dialog, search 등 키보드 상호작용 변경 시에는 수동 keyboard 검토가 필요함
  - 참고: [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)

## 축소하거나 성격을 바꿀 테스트

- **full-page visual snapshot은 layout boundary별 대표 화면만 유지함**
  - 대상: `apps/web/app/(tech)/visual.e2e.test.ts`, `apps/web/app/(home)/home-visual.e2e.test.ts`
  - 근거: 모든 문서·viewport·theme의 full-page screenshot은 문서 내용, 이미지, font rendering 변화로 인해 높은 변경 비용을 만듦
  - 유지 사례: home desktop/mobile, 문서 desktop/mobile, dark theme처럼 서로 다른 layout branch를 대표하는 3~5개 screenshot이 적절함
  - 운영 사례: 나머지 시각 회귀 검사는 PR 차단 대신 수동 확인 또는 별도 정기 실행으로 분리할 수 있음

- **문서별 정확한 featured·related 목록 assertion은 알고리즘 계약으로 일반화함**
  - 대상: `apps/web/app/(tech)/document-discovery.e2e.test.ts`
  - 근거: 특정 문서 ID와 순서를 E2E에 고정하면 정상 콘텐츠 추가·편집도 실패 원인이 됨
  - 유지 사례: 현재 문서 제외, 유효한 locale URL, 최대 표시 개수, 관련 문서 존재 여부를 E2E에서 검증함
  - 이전 사례: ranking, tag 우선순위, fallback 순서는 `apps/web/lib/documents.test.ts`에서 fixture 기반으로 검증함

- **페이지의 정적 문구 존재 여부는 역할·목적을 검증하는 assertion으로 바꿈**
  - 대상: `apps/web/app/(home)/home.e2e.test.ts`, `apps/web/app/(tech)/document-discovery.e2e.test.ts`의 정적 문서명 assertion 일부
  - 근거: 문구 편집은 사용자 흐름의 결함이 아니며, product copy 변경마다 test 변경을 요구함
  - 유지 사례: heading level, navigation landmark, link destination, language 전환과 같이 의미론·동작을 나타내는 assertion이 적절함

## 실행 원칙

- **문서·라우팅·query rule 변경은 Vitest 관련 범위를 먼저 실행함**
  - 명령: `pnpm --filter @jongminchung/web run test`
  - 근거: 빠른 규칙 검증으로 오류 위치를 콘텐츠 schema·routing·생성물 중 하나로 좁힐 수 있음

- **route, Client Component, browser storage, MDX rendering 변경은 E2E를 추가 실행함**
  - 명령: `pnpm --filter @jongminchung/web run test:e2e`
  - 근거: Next.js 공식 가이드의 production server 기반 E2E 경계와 일치함

- **의도한 UI 변경에서만 visual snapshot을 검토·갱신함**
  - 명령: `pnpm --filter @jongminchung/web run test:e2e -- visual.e2e.test.ts` 또는 `pnpm --filter @jongminchung/web run test:e2e -- --update-snapshots`
  - 근거: snapshot은 기능 계약의 대체물이 아니라 시각 변경의 검토 보조 수단임
  - 기준: `*-actual.png`, `*-expected.png`, `*-diff.png`을 검토한 뒤 의도한 변경만 갱신함

- **visual snapshot은 baseline을 만든 동일한 OS·브라우저 환경에서 실행함**
  - 근거: 렌더링은 운영체제, 브라우저 버전, 폰트, 하드웨어, headless 여부에 따라 달라질 수 있음
  - 현재 기준 이미지: `*-darwin.png`이므로 macOS Chromium에서 기준을 생성·검증함
  - CI 전환 조건: Linux CI에서 visual snapshot을 실행하려면 Linux Chromium에서 승인한 기준 이미지를 별도로 생성·커밋함

- **실패 분석에는 Playwright 산출물을 사용함**
  - CI: 첫 재시도에서 trace를 기록하고, 실패한 test의 screenshot·video와 HTML report를 생성함
  - 로컬: `pnpm --filter @jongminchung/web exec playwright test --debug` 또는 `pnpm --filter @jongminchung/web exec playwright show-report`로 재현·분석함

## 공식 참고 문서

- [Next.js Vitest 가이드](https://nextjs.org/docs/pages/guides/testing/vitest)는 동기 Server·Client Component의 unit test와 async Server Component의 E2E 필요성을 구분함
- [Next.js Playwright 가이드](https://nextjs.org/docs/pages/guides/testing/playwright)는 production code에 대한 실제 browser E2E 실행과 `webServer` 사용을 안내함
- [Next.js Testing 개요](https://nextjs.org/docs/pages/guides/testing)는 unit, component, integration, E2E, snapshot test의 역할을 구분함
- [Testing Library 소개](https://testing-library.com/docs/)는 사용자 사용 방식과 유사한 테스트, 구현 세부사항 회피 원칙을 안내함
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)는 user-visible behavior, test isolation, 접근 가능한 locator 사용을 권장함
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)은 axe 자동 검사의 적용 범위와 수동 접근성 검토 필요성을 안내함
