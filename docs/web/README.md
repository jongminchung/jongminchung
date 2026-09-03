# Web 앱 구조

- **`apps/web`은 하나의 Next.js 배포물에서 홈, 기술 문서, 투자 노트 사이트를 제공함**
- **요청 Host는 `proxy.ts`에서 내부 `app/(site)/sites/<site>` 경로로 rewrite됨**
- **기술 문서와 투자 노트 원본은 `content/`에 두고, Next.js Server Component와 route handler가 직접 읽음**
- **`components/`는 화면 조합을, `lib/`는 도메인 규칙과 데이터 조회를, `scripts/`는 생성·검증을 소유함**
- **단위 테스트는 구현 가까이에, 브라우저 E2E 테스트는 기능 경계의 `*.e2e.test.ts` 파일에 배치됨**

## 요청과 라우팅

- **공개 URL과 Next.js 내부 route를 분리해 하나의 앱에서 여러 도메인을 제공함**
  - 근거: [proxy.ts](../../apps/web/proxy.ts)가 Host를 `home`, `tech`, `invest` 사이트로 해석하고 내부 `/sites/<site>` 경로로 rewrite함
  - 사례: `tech.jamie.kr/en/articles/...` 요청은 `app/(tech)/sites/tech/[locale]/[[...slug]]/page.tsx`가 처리함

- **루트 요청은 cookie 우선, `Accept-Language` 차선의 순서로 locale로 redirect됨**
  - 근거: `lib/site-routing.ts`가 Host 정규화, 사이트 판별, locale 선택과 내부 경로 생성을 담당함
  - 사례: `/` 요청은 해당 사이트의 locale cookie 또는 요청 헤더에 따라 `/ko`나 `/en`으로 `307` redirect됨

- **공통 시스템 route와 정적 자산은 rewrite 대상에서 제외됨**
  - 근거: `app/(system)/healthz/route.ts`와 `public/` 자산은 모든 사이트가 공유하는 배포 경계임
  - 사례: `/healthz`, `/_next/`, `/search/`, `/diagrams/` 요청은 사이트별 경로로 변환되지 않음

## 화면과 콘텐츠 계층

- **`app/`은 HTTP route와 site별 layout을 소유함**
  - 근거: `(home)`, `(tech)`, `(invest)` route group은 URL에 노출되지 않으면서 site별 CSS와 페이지 구성을 분리함
  - 사례: 기술 문서는 locale layout, 문서 catch-all route, RSS·sitemap·OG image·`llms.txt` route를 함께 제공함

- **`components/`는 route에서 사용하는 재사용 화면 단위를 소유함**
  - 근거: `components/home/`, `components/invest/`는 사이트 전용 shell을 두고, 최상위 `components/`는 문서 탐색·검색·문서 본문 UI를 제공함
  - 사례: `DocsShell`, `DocumentPage`, `SearchPalette`는 기술 문서 route가 조합하는 UI 경계임

- **`content/`는 사람이 편집하는 원본이며 별도 manifest·loader·검색 산출물을 추적하지 않음**
  - 근거: `content/tech/<locale>/*.mdx`는 문서 frontmatter와 본문을, `content/invest/`는 투자 노트 원본을 보관함
  - 사례: 생성 결과인 content manifest·document loader·투자 loader·검색 JSON은 직접 편집하지 않고 build script로 갱신함

## 도메인 규칙과 생성 과정

- **`lib/`는 route와 component가 공유하는 순수 규칙 및 데이터 접근 계층임**
  - 근거: `content-model.ts`, `documents.ts`, `search.ts`, `site-routing.ts`, `investment-content.ts`가 콘텐츠 schema, 탐색, 검색, routing, 투자 데이터 계약을 정의함
  - 사례: route는 `lib/documents.ts`에서 문서를 읽고, 관련 문서·목차·locale URL 계산은 `lib/` 규칙을 재사용함

- **`scripts/`는 원본을 읽어 산출물을 생성하거나 산출물의 최신 상태를 검증함**
  - 근거: 서버 전용 콘텐츠 repository가 기술 문서와 투자 노트의 metadata·번역·순서 계약을 검증함
  - 사례: `next dev`는 route 요청 시 최신 MDX 원본을 읽고, `next build`는 `generateStaticParams`로 정적 경로를 생성함

- **MDX 변환은 Fumadocs Config API와 remark plugin에서 일관되게 구성됨**
  - 근거: `source.config.ts`가 collection schema와 `lib/remark-kroki-url.ts`를 등록하고 `next.config.ts`가 Fumadocs MDX를 연결함
  - 조건: Kroki URL 정규화가 `remark-image`보다 먼저 실행되어 build가 외부 이미지 크기 조회에 의존하지 않음
  - 사례: 코드 블록과 Excalidraw 다이어그램은 `mdx-components.tsx`, `lib/remark-kroki-url.ts`, `lib/excalidraw-scene.ts`를 통해 렌더링 경계를 가짐

## 공개 자산과 배포

- **`public/`은 런타임에 그대로 제공하는 공용 자산을 소유함**
  - 근거: 검색 index와 Excalidraw source·asset은 route build 결과가 아닌 파일 경로로 제공됨
  - 사례: locale별 `search-index` Route Handler와 `public/diagrams/`는 브라우저가 직접 요청함

- **Next standalone output은 컨테이너 실행 단위로 준비됨**
  - 근거: `next.config.ts`의 `output: "standalone"`과 `scripts/prepare-standalone.ts`가 실행 환경을 구성함
  - 사례: `bun run --filter @jongminchung/web start`는 `.next/standalone/apps/web/server.js`를 실행함

- **배포 환경 변수와 컨테이너 계약은 별도 문서에서 관리됨**
  - 근거: 앱 구조 문서와 인프라 운영 절차를 분리하면 route·콘텐츠 변경이 배포 세부사항을 불필요하게 포함하지 않음
  - 사례: [Web 컨테이너 배포 계약](../../apps/web/DEPLOYMENT.md)이 image와 runtime 계약을 설명함
  - 런타임 계획: [Bun standalone 런타임](bun-standalone-runtime.md)이 앱과 공개 package의 런타임 경계·검증 기준을 기록함

## 테스트와 변경 원칙

- **`*.test.ts`는 빠른 Bun 규칙 테스트, `*.e2e.test.ts`는 Playwright 브라우저 계약 테스트임**
  - 근거: `lib/`, `components/`, `scripts/`의 단위 테스트는 구현과 인접하고, E2E는 home·tech·invest route group 또는 proxy 경계에 배치됨
  - 사례: `app/(tech)/tech.e2e.test.ts`는 검색·locale·브라우저 동작을, `proxy.e2e.test.ts`는 실제 Host routing을 검증함

- **E2E 테스트 수집은 명시적 접미사로 제한됨**
  - 근거: `bunfig.toml`의 `pathIgnorePatterns`와 `playwright.config.ts`의 `testMatch`가 Bun 테스트와 Playwright 테스트의 실행 환경을 분리함
  - 사례: `bun run --filter @jongminchung/web test:e2e`는 production server 기반 전체 브라우저 흐름을 실행함

- **변경 전에는 원본·생성물·route·테스트 경계를 함께 판단해야 함**
  - 근거: 콘텐츠 원본 변경은 generated manifest와 search index에, routing 변경은 세 도메인과 locale cookie에 영향을 줄 수 있음
  - 사례: 상세 실행 기준은 [Web 테스트 전략](../web-testing-strategy.md)과 [기여 가이드](../CONTRIBUTING.md)에 따름
