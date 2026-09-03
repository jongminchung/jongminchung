# Issue 0040: Starlight 전환 없이 Web Tech 유지보수 경계 단순화

- 상태: 완료
- 우선순위: P2
- 기준일: 2026-08-20
- 선행 이슈:
  [Tech 공개 collection 경계](0036-tech-draft-publication-boundary.md),
  [검색 runtime 경계](0032-web-search-runtime-benchmark-boundary.md),
  [URL·feed 계약](0034-web-multisite-url-feed-contract.md),
  [test fixture 경계](0035-web-test-intent-and-corpus-fixtures.md)
- 관련 검토:
  [Starlight 전환 영향](0039-web-tech-starlight-migration-assessment.md)
- 영향 범위:
  [content model](../../apps/web/lib/content-model.ts),
  [content repository](../../apps/web/lib/content-repository.ts),
  [content validation](../../apps/web/lib/content-validation.ts),
  [Tech Docs page route](<../../apps/web/app/(tech)/tech/[locale]/docs/[[...slug]]/page.tsx>),
  [Docs shell](<../../apps/web/app/(tech)/_components/DocsShell.tsx>),
  [Tech search provider](<../../apps/web/app/(tech)/_components/SearchPalette.tsx>),
  [Fumadocs provider](<../../apps/web/app/(tech)/_components/TechFumadocsProvider.tsx>),
  [Tech copy](../../apps/web/lib/tech/copy.ts)
- 공식 근거:
  [Astro islands](https://docs.astro.build/en/concepts/islands/),
  [Starlight route data](https://starlight.astro.build/guides/route-data/),
  [Starlight frontmatter schema](https://starlight.astro.build/reference/frontmatter/),
  [Starlight sidebar](https://starlight.astro.build/guides/sidebar/),
  [Starlight component override](https://starlight.astro.build/guides/overriding-components/)

## 핵심 요약

- **Next.js와 현재 UI를 유지하면서 Astro·Starlight의 content collection·route data·island 원칙만 적용하는 방향임**
- **문서 파일 경로에서 `locale`·`id`와 Docs `area`를 도출해 108개 MDX에 반복된 identity metadata를 제거함**
- **Docs route 해석·metadata·navigation·목차 입력을 immutable `ResolvedTechDocsPage`로 한 번 조립해 page route와 component의 중복 조회를 줄임**
- **`DocsShell` 전체 client boundary와 전역 Query·Zustand provider를 search·sheet·outline·Excalidraw 같은 실제 상호작용 island로 축소함**
- **컴포넌트 안의 한영 삼항 분기를 typed message catalog로 이동해 locale 추가와 문구 변경의 탐색 범위를 한정함**
- **Astro·Starlight·Pagefind dependency, 별도 workspace·배포물과 공개 UI 변경은 이 이슈에 포함하지 않음**

## 가져올 개념과 현재 문제를 연결함

- **Starlight의 content collection 원칙은 작성 원본과 정규화된 문서 모델을 구분하는 데 적용함**
  - Starlight은 frontmatter를 schema로 검증하고 filesystem entry를 collection identity로 사용함
  - 현재 구현도 Zod와 collection validation을 갖추었지만 `locale`·`section`·`id`가 파일 경로와 frontmatter에 동시에 존재함
  - 동일 사실을 두 위치에 기록한 뒤 다시 일치 여부를 검사하는 책임을 제거할 수 있음
- **Starlight의 route data 원칙은 route와 UI 사이에 한 개의 page projection을 두는 데 적용함**
  - Starlight은 현재 page·sidebar·pagination·목차·metadata에 필요한 값을 route data로 모아 component가 같은 입력을 사용하게 함
  - 현재 `page.tsx`는 `generateMetadata`와 page render에서 route ID·section page·document를 각각 다시 해석함
  - route별 immutable view model을 만들면 metadata와 화면이 다른 조회 경로에서 drift할 가능성을 줄일 수 있음
- **Astro islands 원칙은 Client Component를 없애는 규칙이 아니라 상호작용 소유 범위를 작게 만드는 기준으로 사용함**
  - 현재 `DocsShell`과 `Navigation`은 대부분 정적 markup이지만 mobile sheet·search provider 때문에 전체가 Client Component임
  - `TechDataProvider`는 모든 Tech·diagram page를 감싸지만 실제 `useQuery` consumer는 `SearchDialog`와 `ExcalidrawDiagram`뿐임
  - `TechUiProvider`의 Zustand store는 search open·한 번 열린 상태 두 종류만 소유함
- **Starlight의 configuration 우선 원칙은 component 분기보다 data와 semantic HTML을 먼저 선택하는 기준으로 사용함**
  - 단순 link·label·order 변경은 component 구조를 바꾸지 않고 page model과 message data에서 해결함
  - back-to-top과 code copy처럼 작은 동작은 page 전체 provider보다 native anchor와 한 개의 progressive enhancement controller를 우선함
  - custom component가 필요한 related document·Excalidraw 같은 제품 기능은 그대로 명시적으로 유지함

## 파일 경로를 문서 identity의 단일 기준으로 만듦

- **Blog와 Docs collection의 상대 경로에서 identity를 도출함**
  - `blog/en/building-llm.mdx`는 `locale: en`, `id: building-llm`로 정규화함
  - `docs/ko/fe/nextjs-16.mdx`는 `locale: ko`, `area: fe`, `id: nextjs-16`으로 정규화함
  - Docs root와 area `index.mdx`는 각각 `docs-overview`, `<area>-overview`로 정규화함
  - 파일명과 다른 landing ID가 필요한 문서만 `overview: true`라는 편집 의미를 명시함
- **작성자가 입력하는 frontmatter와 runtime metadata type을 분리함**
  - `DocFrontmatter`는 title·description·order·date·tags·status·publication·source 같은 편집 대상만 소유함
  - `DocMetadata`는 `DocFrontmatter`에 경로에서 도출한 `locale`·`section`·`id`를 더한 정규화 결과로 정의함
  - `parseTechContentPath(relativePath)`가 허용되지 않은 locale·section·깊이·확장자를 하나의 오류 경계에서 거부함
- **108개 Tech MDX에서 중복 identity field를 제거함**

  <!-- prettier-ignore -->
  ```yaml
  # 제거 대상
  id: nextjs-16
  locale: en
  area: fe

  # 유지 대상
  title: Next.js 16 Deep Dive
  order: 0
  publicationStatus: published
  <!-- prettier-ignore -->
  ```

- **collection 수준 계약은 약화하지 않음**
  - locale pair와 번역 간 order·status·tags·package metadata 일치를 계속 검증함
  - public URL이 article slug만 사용하므로 서로 다른 collection의 같은 slug 충돌을 계속 거부함
  - Docs area inventory·broken internal link·published TODO 검증을 계속 유지함
  - `0036`이 정의하는 source collection과 published public collection 분리를 먼저 반영함

## 하나의 Tech page model이 route와 UI를 연결함

- **Docs route별 렌더링 입력을 `ResolvedTechDocsPage` discriminated union으로 조립함**

  <!-- prettier-ignore -->
  ```ts
  type ResolvedTechDocsPage =
    | Readonly<{ kind: "not-found" }>
    | Readonly<{ kind: "redirect"; destination: string }>
    | Readonly<{
        kind: "landing" | "article";
        locale: Locale;
        page: DocsPageManifestEntry;
        alternatePage: DocsPageManifestEntry;
      }>;
  <!-- prettier-ignore -->
  ```

- **`resolveTechDocsPage(locale, slugs)`가 route 해석과 조회 순서를 한 번 소유함**
  - locale·slugs를 public route identity로 변환함
  - published document 또는 Docs root landing을 찾음
  - redirect·alternate URL·page tree 공개 URL·related 입력을 같은 source에서 계산함
  - 존재하지 않는 route는 `not-found` model로 반환하고 Next route가 `notFound()`를 결정함
- **`generateMetadata`와 page render가 같은 cached resolver를 사용함**
  - redirect와 collection 해석을 route file 밖의 순수 module로 이동함
  - 같은 요청에서 content snapshot·page를 반복 조회하지 않도록 React `cache()`와 repository의 immutable snapshot을 사용함
  - process 전역의 mutable request state나 service container를 추가하지 않음
- **UI component는 이미 결정된 page model을 렌더링함**
  - `DocsShell`은 resolver가 결정한 alternate URL과 server-rendered content를 받음
  - article 본문 loader는 resolver가 결정한 metadata·related 입력을 다시 조회하지 않음
  - root landing과 article page가 동일한 localized collection source를 사용함

## 상호작용만 작은 client island로 남김

- **`DocsShell`을 Server Component shell과 client control로 분리함**
  - desktop Global Rail·context navigation·main layout은 server markup으로 렌더링함
  - mobile·tablet `Sheet`의 open state와 focus return만 `ResponsiveNavigationControls`가 소유함
  - server-rendered navigation을 client sheet의 slot으로 전달해 navigation data와 markup을 client에서 다시 계산하지 않음
- **search 상태를 search island 안으로 한정함**
  - `SearchProvider`가 open·hasOpened·trigger focus와 keyboard shortcut을 직접 소유함
  - 세 개 state action만 위한 `TechUiProvider`, `ui-store.ts`와 `zustand` dependency를 제거함
  - `SearchDialog` lazy loading과 첫 open 이후 index fetch 동작은 유지함
  - 검색 algorithm·benchmark·index route 변경은 `0032`가 소유함
- **Query client를 실제 query consumer 가까이 이동함**
  - Tech locale layout과 diagram layout의 전역 `TechDataProvider`를 제거함
  - search와 remote Excalidraw가 각각 필요한 cache·retry 경계를 local provider 또는 작은 query adapter로 소유함
  - TanStack Query 제거 여부는 local 경계 적용 후 dependency 가치와 초기 전송 test를 보고 별도로 결정함
- **작은 동작은 React hydration보다 progressive enhancement를 우선함**
  - `BackToTopButton`은 `#top` anchor와 CSS smooth scroll로 대체 가능함
  - `DocsCodeBlock`은 server-rendered code·button과 page당 한 개의 delegated copy controller로 구성함
  - code block마다 source 문자열과 React state를 hydrate하지 않도록 함
  - `DocumentOutline`은 static link 목록을 server에서 만들고 active heading 추적만 작은 client controller가 소유함
- **client component에 전달하는 값은 작은 직렬화 모델로 제한함**
  - mobile sheet에는 label·href·selected 같은 navigation projection만 전달함
  - search는 index URL과 locale만 전달함
  - Excalidraw는 scene source 또는 asset URL만 전달하고 전체 content snapshot을 전달하지 않음

## locale copy를 typed message catalog로 정리함

- **Tech 사용자 문구의 조회 API를 `getTechMessages(locale)`로 통합함**
  - navigation·search·document header·outline·pagination·related document 문구를 feature별 nested object로 구성함
  - `tech-navigation.ts`, `copy.ts`와 component 내부 한영 삼항 연산자에 흩어진 문구를 한 contract로 모음
  - `satisfies Record<Locale, TechMessages>`로 locale별 key 누락을 compile time에 거부함
- **content copy와 protocol copy는 무리하게 한 객체로 합치지 않음**
  - 문서 title·description·본문은 MDX frontmatter와 content가 계속 소유함
  - RSS language tag·Open Graph locale 같은 protocol mapping은 site·feed helper가 소유함
  - section landing title·description은 UI message인지 page metadata인지 한 owner를 정한 뒤 page model에서 재사용함
- **component는 locale을 분기하지 않고 이미 선택된 message를 사용함**
  - 접근성 label·loading·error·empty·button copy를 동일한 message source에서 읽음
  - locale switch의 target locale과 href 계산은 content model helper가 계속 소유함
  - translation runtime·외부 i18n dependency와 fallback language 기능은 추가하지 않음

## 현재 확인된 interaction 후속 항목을 구체화함

- **localized route에 남은 고정 영어 accessible name을 typed message catalog로 이동함**
  - `EditorialHeader`의 `Editorial navigation`과 `EditorialIndex`의 `Editorial controls`가 locale과 관계없이 영어로 노출됨
  - `FootnoteReference`의 preview region도 `Footnote preview`를 고정값으로 사용함
  - product name·protocol name을 제외한 navigation·control·region label은 현재 document language와 일치해야 함
- **검색 단축키 표기가 실제 platform input과 일치하도록 정리함**
  - `SearchTrigger`가 모든 환경에서 `⌘K`를 표시함
  - macOS는 `⌘K`, Windows·Linux는 `Ctrl K`를 표시하되 server markup과 hydration mismatch를 만들지 않는 경계를 정해야 함
  - 화면에 표시하는 단축키와 Fumadocs provider가 실제 처리하는 key combination을 같은 browser test에서 검증해야 함
- **맨 위 이동을 native navigation과 focus context로 완결함**
  - 완료 이슈 [`0042`](archive/2026/0042-web-editorial-progressive-navigation.md)는 기존 button이 reduced motion을 존중하도록 보강함
  - 후속 단계에서는 `#top` anchor와 focus 가능한 target을 사용해 JavaScript 없이도 이동할 수 있어야 함
  - keyboard와 screen reader 사용자가 이동 뒤 문서 시작 위치를 인지할 수 있도록 focus·route announcement 영향을 검증해야 함
- **기본 동작을 유지하는 control에는 client state를 추가하지 않음**
  - mobile 목차의 native `details`와 locale switch anchor는 JavaScript가 없어도 핵심 탐색을 수행함
  - disclosure 자동 닫기나 locale preference 저장 편의 기능은 hydration 비용과 focus 회귀가 없는 경우에만 추가함
  - storage 접근 실패는 locale 목적지 탐색과 분리된 best-effort persistence로 유지해야 함

## 적용하지 않을 내용과 이슈 경계를 지킴

- **`astro`, `@astrojs/starlight`, Pagefind와 Astro adapter를 dependency에 추가하지 않음**
  - 설계 원칙만 가져오며 Next build·standalone·Host routing 계약을 유지함
- **Starlight의 component 이름과 directory 구조를 그대로 복제하지 않음**
  - `Astro.locals`나 route middleware를 흉내 낸 global context를 만들지 않음
  - 현재 제품 언어에 맞는 `ResolvedTechDocsPage`, content source와 client control 이름을 사용함
- **consumer 없는 generated manifest와 static artifact를 다시 도입하지 않음**
  - runtime content repository와 published collection이 실제 consumer를 계속 제공함
  - 검색 artifact 변경은 benchmark와 runtime consumer를 가진 `0032`에서만 결정함
- **공개 동작과 정보 구조를 바꾸지 않음**
  - URL·canonical·locale cookie·`Content-Language`·RSS·sitemap은 `0034`와 현재 contract를 유지함
  - Global Rail·section navigation·related ranking·검색 결과 의미·Excalidraw 기능을 유지함
  - visual redesign이나 Starlight와 유사한 CSS 적용을 목표로 하지 않음
- **모든 component를 Server Component로 바꾸지 않음**
  - focus management·keyboard shortcut·dialog·sheet·scroll spy·canvas처럼 browser state가 필요한 경계는 Client Component로 유지함
  - 목적은 client file 수가 아니라 state·provider·직렬화 책임의 축소임

## 실행 순서와 검증 기준을 명확히 함

- **선행 계약을 먼저 안정화함**
  - `0036`의 draft 공개 차단을 완료해 page model이 published collection만 읽도록 함
  - `0032`의 search runtime·benchmark 경계와 `0034`의 URL·feed helper를 완료함
  - `0035`의 작은 fixture를 route data와 navigation 회귀 검증에 재사용함
- **구현은 독립적으로 검증 가능한 네 단계로 나눔**
  - 1단계에서 path identity parser와 frontmatter schema를 도입하고 108개 MDX의 중복 field를 제거함
  - 2단계에서 `ResolvedTechDocsPage` resolver를 추가하고 metadata·page render의 중복 조회를 통합함
  - 3단계에서 typed message catalog를 도입하고 component locale 분기를 제거함
  - 4단계에서 Docs shell·search·query·code copy·outline client boundary를 축소함
- **완료 조건은 코드 이동이 아니라 중복 owner 제거로 판단함**
  - `id`·`locale`과 Docs `area`를 Tech frontmatter에 직접 작성하지 않음
  - path identity와 normalized metadata의 정상·실패 fixture가 존재함
  - metadata와 page render가 같은 `ResolvedTechDocsPage` resolver를 사용함
  - Tech root에 전역 Query provider가 없고 query consumer가 local owner를 가짐
  - search open state만을 위한 Zustand store와 provider가 남지 않음
  - code block마다 별도 React copy state를 만들지 않음
  - targeted Tech component에 사용자 문구를 선택하는 `locale === "ko"` 분기가 남지 않음
  - 기존 URL·search·theme·locale·navigation·outline·related·diagram E2E가 통과함
- **client boundary 변경 전후를 같은 기준으로 비교함**
  - route별 초기 전송량 테스트에서 Tech의 client asset과 예산을 비교함
  - action 이후 요청되는 async asset과 dependency owner는 production Playwright와 source dependency graph로 확인함
  - page source와 hydration warning이 없는지 production Playwright로 확인함
  - visual snapshot 변경이 발생하면 구조 변경의 의도된 결과인지 별도로 검토함
- **영향받는 workspace와 전체 저장소 계약을 검증함**
  - `pnpm --filter @jongminchung/web run typecheck`
  - `pnpm --filter @jongminchung/web run test`
  - `pnpm --filter @jongminchung/web run build`
  - `pnpm --filter @jongminchung/web exec playwright test app/initial-transfer.e2e.test.ts --project tech-chromium`
  - `pnpm --filter @jongminchung/web run test:e2e`
  - `pnpm run check`
  - `git diff --check`
