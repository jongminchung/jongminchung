# Issue 0039: Web Tech 문서의 Starlight 전환 영향 검토

- 상태: 조건부 보류
- 우선순위: P3
- 기준일: 2026-08-20
- 영향 범위:
  [Web package](../../apps/web/package.json),
  [Tech route](<../../apps/web/app/(tech)>),
  [Tech content](../../apps/web/content/tech),
  [content repository](../../apps/web/lib/content-repository.ts),
  [site routing](../../apps/web/lib/site-routing.ts),
  [Web deployment](../../apps/web/DEPLOYMENT.md),
  [Web workflow](../../.github/workflows/web.yml)
- 공식 근거:
  [Starlight 개요](https://starlight.astro.build/),
  [다국어 구성](https://starlight.astro.build/guides/i18n/),
  [frontmatter schema](https://starlight.astro.build/reference/frontmatter/),
  [sidebar](https://starlight.astro.build/guides/sidebar/),
  [검색](https://starlight.astro.build/guides/site-search/),
  [component override](https://starlight.astro.build/guides/overriding-components/),
  [Astro endpoint](https://docs.astro.build/en/guides/endpoints/)

## 핵심 요약

- **Starlight은 Next.js에서 교체해 쓰는 문서 UI package가 아니라 Astro 통합이므로 `apps/web` 내부의 Tech route만 점진적으로 바꾸는 방식으로 적용할 수 없음**
- **도입 시 권장 경계는 `tech.jamie.kr`을 별도 Astro·Starlight workspace와 배포물로 분리하고 기존 `apps/web`에는 Home·Invest만 남기는 구조임**
- **Starlight 기본 기능은 sidebar·목차·이전/다음·다국어 UI·테마·코드 블록·Pagefind 검색을 대체할 수 있어 Tech 전용 화면 코드의 상당 부분을 제거할 수 있음**
- **현재 고유 계약인 관련 문서 ranking·한영 metadata 일치·내부 링크 검증·검색 benchmark·`llms.txt`·RSS·동적 OG 이미지·Excalidraw는 별도 구현이나 검증을 계속 소유해야 함**
- **단일 컨테이너의 Host rewrite, `/`의 언어 선택과 cookie, `Content-Language`, Home의 최신 Tech 글 조회가 workspace 분리의 선행 설계 과제임**
- **표준 Starlight UI 수용과 분리 배포가 가능할 때만 pilot 가치가 있으며 기존 화면을 component override로 그대로 재현해야 한다면 전환 이점이 작음**

## 현재 구조에서 전환 단위가 달라짐

- **현재 `apps/web`은 한 Next.js standalone 서버가 `jamie.kr`·`tech.jamie.kr`·`invest.jamie.kr`을 함께 처리함**
    - `proxy.ts`가 Host를 `home`·`tech`·`invest`로 해석하고 공개 경로를 site별 내부 route로 rewrite함
    - `/healthz`, locale cookie와 `Content-Language`도 하나의 서버 계약에 포함됨
- **Tech 문서는 이미 독립 제품에 가까운 범위를 가짐**
    - 한영 MDX 64개가 32개 번역 쌍을 구성함
    - `app/(tech)` 아래에 문서·검색·다이어그램·RSS·sitemap·robots·OG·`llms.txt` route가 함께 있음
    - `_components`에는 navigation·search·outline·pager·landing·code block·Excalidraw를 포함한 37개 파일이 있음
- **Starlight 적용은 이 Tech 범위를 Astro application boundary로 옮기는 작업임**
    - Starlight은 Astro content collection과 Astro file route를 사용함
    - Next `layout.tsx`·`page.tsx`·Route Handler를 Starlight 설정·Astro page·static endpoint로 일대일 치환하는 migration이 필요함
    - `apps/web` 전체를 Astro로 바꾸면 Home·Invest까지 불필요하게 재작성되므로 Tech 분리가 더 작은 변경 범위임

## 표준 기능으로 대체되는 책임이 있음

- **문서 shell과 탐색 UI는 Starlight 기본 layout으로 대체 가능함**
    - `DocsShell`, `Navigation`, `DocumentOutline`, `DocumentPager`의 핵심 책임을 sidebar·page sidebar·pagination·mobile navigation이 제공함
    - 현재 `BackToTopButton` 동작까지 유지하려면 작은 custom component가 필요함
    - 현재 Global Rail과 section별 context navigation을 표준 sidebar로 바꾸는 시각·정보 구조 변경이 수반됨
- **검색은 custom JSON index와 dialog 대신 build 시 생성되는 Pagefind로 대체 가능함**
    - `SearchPalette`, `SearchDialog`, `search-index` route와 client scoring runtime을 제거할 수 있음
    - Pagefind의 relevance와 index 분할 방식은 현재 title·API symbol·heading·tag 가중치와 동일하지 않으므로 품질 동등성을 별도로 증명해야 함
- **한영 문서 UI와 언어 전환은 Starlight i18n으로 대체 가능함**
    - `ko`·`en` locale과 같은 상대 파일명을 사용하면 번역 문서를 연결할 수 있음
    - 한국어 UI 문자열, fallback notice와 language selector는 기본 기능으로 제공됨
    - 현재 공개 URL이 두 locale 모두 prefix를 사용하므로 root locale 없이 `/ko/**`·`/en/**`를 유지해야 함
- **코드 블록과 기본 문서 MDX 표현은 Starlight의 Markdown·Expressive Code 경계로 이동 가능함**
    - `DocsCodeBlock`의 syntax highlighting·copy UI를 기본 코드 블록으로 대체 가능함
    - 현재 overview의 암묵적 `OverviewHero`·`QuickStart`·`OverviewCards`·`OverviewCta`는 Starlight splash·hero·card로 바꾸거나 MDX에서 명시적으로 import해야 함
- **문서별 metadata type은 Starlight `docsSchema()` 확장으로 수용 가능함**
    - `description`, `publishedAt`, `updatedAt`, `verifiedAt`, `tags`, `status`, `sourceUrl`, package metadata를 custom schema에 유지할 수 있음
    - sidebar label·order·badge, draft, last updated와 같이 대응되는 기본 frontmatter는 중복 필드를 만들지 않도록 한 쪽을 canonical source로 정해야 함

## 제품 고유 계약은 계속 소유해야 함

- **collection 전체를 비교하는 validation은 Starlight schema만으로 대체되지 않음**
    - locale pair 누락과 한영 metadata 불일치 검증이 계속 필요함
    - section별 연속 order, 중복 URL, 내부 링크와 published 문서의 blocking TODO 검증이 계속 필요함
    - field 단위 schema는 `docsSchema()`로 이동하되 collection validation은 별도 build check로 유지해야 함
- **관련 문서 기능은 Starlight 기본 pagination과 다른 제품 기능임**
    - 현재 shared tag·same section·order distance·updated date를 조합해 최대 3개를 노출함
    - 기능을 유지하면 custom Astro component와 ranking module이 필요하고 제거하면 공개 화면 계약 변경으로 취급해야 함
- **검색 교체는 현재 bilingual benchmark를 통과해야 함**
    - 현재 40개 한영 query가 top-1·top-3·MRR·zero-result와 index 비용을 검증함
    - 현재 baseline의 index 크기는 `1,040,636` bytes이며 Pagefind의 전체 전송량·첫 검색 요청 수와 같은 기준으로 다시 측정해야 함
    - 한국어 무공백 query와 API symbol query가 현재 최소 품질을 충족하지 못하면 Pagefind 기본 설정만으로 교체할 수 없음
- **discovery endpoint는 Astro 방식으로 다시 구성해야 함**
    - `robots.txt`는 static file 또는 Astro endpoint로 이동 가능함
    - sitemap entry는 `@astrojs/sitemap`으로 만들 수 있지만 현재 `lastModified`와 locale alternate 계약을 serializer에서 보존해야 함
    - 현재 공개 경로인 `/sitemap.xml`과 integration의 출력 파일명이 다르면 custom endpoint 또는 명시적 redirect가 필요함
    - locale별 RSS는 `@astrojs/rss`, `llms.txt`는 static endpoint로 옮길 수 있지만 콘텐츠 선택과 출력 contract test는 유지해야 함
    - 현재 `next/og`의 문서별 동적 이미지는 Starlight 기본 기능이 아니므로 build-time 이미지 생성 또는 Astro SSR endpoint 중 하나가 필요함
- **Excalidraw는 별도 Astro page와 React island로 이동해야 함**
    - `/diagrams`와 `/diagrams/[slug]`는 Starlight docs collection 밖의 custom page로 유지 가능함
    - 기존 React renderer를 재사용하면 `@astrojs/react`와 hydration directive가 필요함
    - source download·fullscreen·loading·error·접근성 상태의 Playwright 계약을 계속 검증해야 함
- **scheduled freshness evidence는 framework와 무관한 운영 계약임**
    - `verifiedAt`과 `sourceUrl` 기반 freshness·network evidence 생성을 새 content owner로 이동해야 함
    - Starlight 도입만으로 source freshness가 보장되는 것으로 간주할 수 없음

## workspace와 파일 소유권이 재편됨

- **목표 구조는 Tech를 새 workspace로 분리하는 형태가 적절함**

    ```text
    apps/
      web/                     # Home·Invest·공통 system route
      tech-docs/
        astro.config.ts
        src/content.config.ts
        src/content/docs/      # ko·en 문서와 section landing
        src/components/        # brand·related documents·필요한 override
        src/pages/             # RSS·llms.txt·robots·diagram·OG
        public/                # diagram source와 Excalidraw asset
    ```

- **`apps/web`에서는 Tech 전용 Next 경계를 제거하게 됨**
    - `app/(tech)/**`, `lib/tech/**`, `#tech-components/*` alias와 Tech visual snapshot을 이동 또는 제거함
    - `next.config.ts`의 Tech MDX output tracing을 제거하고 Invest content tracing만 유지함
    - Tech에서만 사용하는 `@excalidraw/excalidraw`, `@tanstack/react-query`, `zustand` dependency는 새 workspace로 이동 가능함
    - `@mdx-js/mdx`처럼 Invest도 사용하는 dependency는 `apps/web`에 남겨야 함
- **새 workspace는 Astro 명령을 직접 소유해야 함**
    - `dev`, `build`, `typecheck`, `test`, `test:e2e`를 `apps/tech-docs/package.json`에 둠
    - 단일 workspace 실행은 `pnpm --filter @jongminchung/tech-docs run <script>`로 수행함
    - root 별칭을 추가하지 않고 기존 `pnpm -r --if-present` orchestration에 참여시킴
- **Home의 최신 Tech 글 조회 때문에 content 소유권을 별도로 결정해야 함**
    - 현재 `WritingSection`은 `getLocalizedDocuments()`로 Tech 원본을 같은 process에서 직접 읽음
    - 분리 후 network fetch를 Next build의 필수 조건으로 만들면 두 배포물의 가용성과 build 순서가 결합됨
    - production 전환 시 두 consumer가 읽는 metadata·source를 작은 `tech-content` workspace로 분리하거나 명시적인 build artifact 계약을 두는 선택이 필요함
    - consumer가 생기기 전부터 공용 package를 만들지 않고 pilot에서 두 방식의 build·배포 결합도를 비교해야 함

## URL과 배포 계약 변경이 가장 큼

- **공개 문서 URL은 source 위치와 분리해 그대로 유지해야 함**
    - overview는 `/ko`·`/en`을 유지함
    - 문서는 `/ko/articles/<slug>`·`/en/articles/<slug>`를 유지함
    - section landing은 `/ko/series/<section>`·`/en/series/<section>`을 유지함
    - Astro의 trailing slash와 redirect 설정을 현재 slash 없는 canonical URL에 맞추고 64개 문서 URL manifest를 비교해야 함
- **현재 `/` locale redirect는 정적 Starlight만으로 같은 서버 동작을 제공하지 않음**
    - 현재는 site별 cookie를 먼저 보고 `Accept-Language`를 다음으로 사용해 `307` redirect함
    - 순수 static 배포를 선택하면 edge·ingress가 이 계약을 소유하거나 고정 locale redirect로 제품 동작을 변경해야 함
    - Astro Node adapter를 사용하면 middleware로 보존할 수 있지만 static hosting 단순화 이점은 줄어듦
- **`Content-Language`와 locale cookie도 runtime 또는 edge 책임으로 이동함**
    - Starlight이 생성하는 `<html lang>`과 HTTP `Content-Language` header는 별도 계약임
    - 현재 E2E를 유지하려면 Node middleware 또는 host/path 기반 edge header 정책이 필요함
    - 기본 language selector는 현재 `tech-locale` cookie 저장 동작과 같지 않으므로 동작 변경 여부를 결정해야 함
- **단일 컨테이너 배포 계약은 더 이상 유지되지 않음**
    - 권장안은 `tech.jamie.kr`을 Tech 정적 배포물 또는 Astro Node service로 직접 연결하는 방식임
    - `jamie.kr`·`invest.jamie.kr`은 기존 Next service에 남음
    - 인프라 저장소의 Ingress·Service·Deployment와 이 저장소의 Docker·health check 문서를 함께 변경해야 함
    - 한 컨테이너 안에서 Next와 Astro server를 동시에 실행하는 방식은 process·health·shutdown 책임을 복잡하게 하므로 채택하지 않음

## 선택지는 표준 UI 수용 여부로 갈림

- **선택지 A인 별도 Starlight workspace가 장기 권장안임**
    - Tech가 정적 문서 중심 제품이고 Home·Invest와 공개 host가 이미 분리되어 있어 framework 경계와 제품 경계가 일치함
    - Starlight 기본 navigation·search·i18n·code UI를 수용할수록 custom client code와 회귀 테스트 범위를 줄일 수 있음
    - 배포물과 content 연동이 늘어나는 비용을 감수해야 함
- **선택지 B인 `apps/web` 전체 Astro 전환은 권장하지 않음**
    - Starlight의 이점과 무관한 Home·Invest route·MDX·metadata·visual test를 함께 재작성해야 함
    - 세 Host의 내부 rewrite와 서로 다른 site metadata를 Astro 한 config에서 다시 모델링해야 함
    - 변경 범위가 Tech 문서 개선이라는 목적을 초과함
- **선택지 C인 기존 UI의 Starlight override 재현도 권장하지 않음**
    - Global Rail·context navigation·search dialog·document header·related documents를 모두 override하면 제거할 코드가 적음
    - Starlight 상위 layout override는 upstream structure 변화와 함께 유지보수해야 함
    - 이 경우 현재 Next 구현을 유지하는 편이 framework와 배포 경계를 늘리지 않음
- **현재는 조건이 확정되지 않아 production dependency와 route를 추가하지 않음**
    - 별도 배포 승인, 표준 UI 수용 범위와 Home 최신 글 data boundary가 먼저 결정되어야 함
    - 검색·URL·discovery contract를 통과하는 isolated pilot 전에는 production traffic을 전환하지 않음

## 실행 조건과 pilot 검증 기준을 둠

- **다음 조건을 모두 충족하면 isolated pilot을 시작함**
    - `tech.jamie.kr`의 별도 deployment와 infrastructure 변경을 수용함
    - Starlight 기본 Header·Sidebar·Search·Table of Contents·Pagination 사용을 기본값으로 승인함
    - custom override를 brand와 관련 문서처럼 제품 고유 기능으로 제한함
    - Home 최신 글이 읽을 canonical metadata boundary를 선택함
    - root locale redirect·cookie·`Content-Language`를 application과 edge 중 어디서 소유할지 결정함
- **pilot은 전체 이중 운영이 아니라 대표 vertical slice로 제한함**
    - overview, Handbook 1개, Deep Dive 1개의 한영 문서로 route·translation·sidebar·MDX를 확인함
    - Pagefind runner를 현재 40개 bilingual benchmark corpus에 연결해 전체 corpus 검색 품질과 asset 비용을 비교함
    - RSS·sitemap·`llms.txt`·OG와 Excalidraw는 각각 한 개 대표 artifact 또는 page로 contract를 확인함
    - prototype content를 장기 복제하지 않고 전환 여부 결정 후 제거하거나 canonical source로 이동함
- **production 전환 완료 조건은 공개 계약 동등성과 책임 축소임**
    - 기존 64개 문서와 section URL이 redirect 없이 같은 canonical URL에서 응답함
    - locale alternate·metadata·sitemap·RSS·robots·`llms.txt`·OG image 계약이 유지됨
    - 검색 benchmark가 현재 최소 threshold를 통과하고 index·runtime 비용 회귀가 승인됨
    - keyboard navigation·theme·language switch·mobile sidebar·Excalidraw 접근성 E2E가 통과함
    - 제거 대상 Next Tech code와 dependency에 consumer가 남지 않음
- **구현 시 workspace와 전체 저장소 계약을 함께 검증함**
    - `pnpm --filter @jongminchung/tech-docs run typecheck`
    - `pnpm --filter @jongminchung/tech-docs run test`
    - `pnpm --filter @jongminchung/tech-docs run build`
    - `pnpm --filter @jongminchung/tech-docs run test:e2e`
    - `pnpm --filter @jongminchung/web run typecheck`
    - `pnpm --filter @jongminchung/web run test`
    - `pnpm --filter @jongminchung/web run build`
    - `pnpm run check`
    - `git diff --check`
