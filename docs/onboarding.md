# `jongminchung` 기술·아키텍처·유지보수 온보딩

> 기준일 `2026-09-03` · 저장소의 manifest, 설정, 소스와 workflow를 기준으로 검증함

## 핵심 요약

- **이 저장소는 Bun 모노레포이며 `apps/web`, `packages/ui`, `packages/tooling`의 세 workspace를 하나의 루트 검증 계약으로 관리함**
- **Web은 React 19와 Next.js 16 App Router로 구현된 단일 배포물이며 요청 Host에 따라 Home·Tech Docs·Invest 사이트를 분리함**
- **콘텐츠는 외부 CMS나 데이터베이스가 아니라 저장소의 MDX·Excalidraw 원본이며 Fumadocs와 Zod가 빌드 시 구조와 게시 계약을 검증함**
- **스타일은 Tailwind CSS 4의 CSS-first 방식과 `@jongminchung/ui`의 semantic token·Base UI primitive를 사용하며 제품 조합은 `apps/web`이 소유함**
- **일상 변경은 가장 가까운 workspace 검사 후 `bun run check`로 닫고 route·UI·배포 변경은 build와 Playwright E2E까지 검증함**
- **이 문서는 arc42의 12개 관점과 C4의 Context·Container·Component 관점을 연결하며 모든 다이어그램은 수정 가능한 PlantUML 원본을 가짐**

## 문서를 읽고 첫 실행까지 완료함

### 문서의 범위와 읽는 순서를 이해함

- **처음 참여하는 개발자는 이 절의 설치와 실행을 먼저 완료한 뒤 C4 Context → Container → Component 순서로 구조를 좁혀 읽는 방식이 적합함**
    - 프론트엔드 작업자는 `arc42 5`, `arc42 6`, 기술 스택의 React·Next.js·Tailwind CSS 항목을 우선 확인함
    - 콘텐츠 작업자는 `arc42 5`, MDX 콘텐츠 흐름, 콘텐츠 변경 검증 항목을 우선 확인함
    - 운영·릴리스 작업자는 `arc42 7`, `arc42 9`, 유지보수 실행 절차를 우선 확인함
- **arc42는 문서의 누락을 줄이는 목차이고 C4는 구조를 확대·축소해 보는 표기법이며 PlantUML은 그 관점을 코드로 보관하는 수단임**
    - [arc42 공식 문서](https://docs.arc42.org/home/)는 목표부터 용어집까지 12개 절의 책임을 정의함
    - [C4 공식 다이어그램 안내](https://c4model.com/diagrams)는 Context·Container·Component·Code의 확대 수준을 정의함
    - [PlantUML 공식 문서](https://plantuml.com/)와 [C4-PlantUML 공식 저장소](https://github.com/plantuml-stdlib/C4-PlantUML)는 텍스트 기반 다이어그램 문법을 제공함
    - [Kroki 공식 문서](https://docs.kroki.io/kroki/)는 PlantUML을 포함한 여러 다이어그램 형식의 HTTP 렌더링 API를 설명함
- **다이어그램은 Kroki의 공개 SVG URL로 표시되며 렌더 서비스가 응답하지 않아도 같은 위치의 `.puml` 원본을 읽고 수정할 수 있음**
    - URL에는 deflate·base64url로 인코딩된 다이어그램 원문이 포함되므로 공개 저장소에 둘 수 없는 값을 다이어그램에 기록하면 안 됨
    - `apps/web`의 MDX에서는 `lib/remark-kroki-url.ts`가 `plantuml` 코드 블록을 같은 방식의 이미지 URL로 변환함

### 개발 환경을 저장소 계약과 일치시킴

- **정확한 앱·도구 기준은 `.bun-version`과 루트 `package.json#packageManager`의 Bun `1.4.0`임**
    - 루트 engine은 Bun `>=1.4.0`의 허용 범위를 제공하지만 재현 가능한 온보딩에는 고정 버전을 권장함
    - Bun은 workspace 연결, 단일 lockfile, catalog·filter 명령과 Web의 Next.js main·standalone 런타임을 제공함
    - `.node-version`의 Node.js `26.7.0`은 Fumadocs·Turbopack loader worker, 공개 `packages/*`의 호환 테스트와 게시 후 소비자 검증에 사용함
    - 공식 학습 자료는 [Bun runtime](https://bun.sh/docs/runtime), [workspace](https://bun.sh/docs/pm/workspaces), [catalog](https://bun.sh/docs/pm/catalogs), [filter](https://bun.sh/docs/pm/filter) 문서임
- **일반 로컬 개발에는 애플리케이션 secret이나 외부 데이터베이스가 필요하지 않음**
    - 코드가 직접 읽는 개발 선택값은 `JAMIE_LOCAL_SITE`이며 `dev:home`, `dev:tech`, `dev:invest` script가 안전한 값으로 설정함
    - `VERCEL`, `CI`, `PLAYWRIGHT_TEST`, `NODE_ENV`는 배포·CI·테스트 도구가 설정하는 실행 경계임
    - `.env.local` 같은 로컬 파일은 내용 확인이나 커밋 대상이 아니며 새 환경 변수가 필요할 때 이름·소유자·필수 여부·실패 동작을 문서화해야 함
- **저장소 루트에서 다음 순서로 버전과 설치 상태를 맞춤**

```sh
git clone https://github.com/jongminchung/jongminchung.git
cd jongminchung
bun --version
node --version
bun install --frozen-lockfile
```

- **설치가 실패하면 lockfile을 재작성하기 전에 런타임 버전과 registry 접근 여부를 먼저 확인함**
    - 일반 workspace 설치는 공개 npm registry와 lockfile만 사용함
    - 외부 프로젝트에서 `@jongminchung/*` 게시 패키지를 받을 때만 GitHub Packages용 classic PAT의 `read:packages` 권한이 필요함
    - 저장소 안의 Web은 `workspace:*`로 로컬 `@jongminchung/ui`를 소비하므로 GitHub Packages token이 필요하지 않음

### 30분 안에 세 사이트와 기본 검사를 확인함

- **첫 실행은 Home 하나를 loopback Host에서 여는 다음 명령으로 시작함**

```sh
bun run --filter @jongminchung/web dev
```

- **개발 서버가 준비되면 Host별 공개 경계를 확인함**
    - `http://localhost:3000/en`은 Home을 표시함
    - `http://tech.jamie.localhost:3000/en`은 Tech Docs를 표시함
    - `http://invest.jamie.localhost:3000/en`은 Invest를 표시함
    - `/`은 site별 locale cookie를 우선하고 `Accept-Language`를 차선으로 사용해 `/ko` 또는 `/en`으로 `307` redirect됨
- **하나의 사이트만 `localhost`로 확인할 때는 명시적 site 선택 script를 사용함**

```sh
bun run --filter @jongminchung/web dev:home
bun run --filter @jongminchung/web dev:tech
bun run --filter @jongminchung/web dev:invest
```

- **첫 코드 탐색은 다음 파일을 순서대로 열어 요청이 화면으로 바뀌는 경로를 따라감**
    - `apps/web/proxy.ts`에서 공개 Host와 내부 route rewrite를 확인함
    - `apps/web/lib/site-routing.ts`에서 Host·locale·cookie 규칙을 확인함
    - `apps/web/app/(tech)/tech/[locale]/docs/[[...slug]]/page.tsx`에서 Server Component 조합을 확인함
    - `apps/web/lib/content-repository.ts`에서 검증된 콘텐츠 snapshot 경계를 확인함
    - `apps/web/source.config.ts`에서 MDX collection·Zod schema·PlantUML plugin을 확인함
    - `packages/ui/src/styles/globals.css`에서 Tailwind source와 공통 theme 진입점을 확인함
- **기본 상태 확인은 가장 가까운 Web 검사와 저장소 전체 검사로 완료함**

```sh
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/web test
bun run check
```

## 목표·제약·시스템 경계를 파악함

### arc42 1 · 시스템 목표와 이해관계자를 정의함

- **제품 목표는 하나의 코드베이스에서 개인 프로필, 이중 언어 기술 콘텐츠, 투자 노트를 일관된 경험으로 제공하고 공용 UI·도구 계약을 다른 프로젝트에도 배포하는 것임**
    - 방문자는 Home·Tech·Invest의 공개 콘텐츠와 검색·RSS·sitemap·OG metadata를 소비함
    - 콘텐츠 작성자는 한국어·영어 MDX와 출처·검증일·게시 상태를 관리함
    - 프론트엔드 유지보수자는 route·React component·스타일·접근성·성능을 관리함
    - 패키지 소비자는 `@jongminchung/ui`와 `@jongminchung/tooling`의 ESM·CSS 공개 subpath를 사용함
    - 운영자는 GitHub Actions, Vercel 또는 standalone container, GitHub Packages를 관리함
- **최상위 품질 목표는 변경 안전성, 콘텐츠 신뢰성, 접근성, 작은 client 경계, 소유권이 분명한 UI임**
    - 변경 안전성은 strict TypeScript, 정적 분석, coverage, build, Playwright로 확보함
    - 콘텐츠 신뢰성은 Zod schema, 언어 쌍과 inventory 검증, `verifiedAt`·`sourceUrl` metadata로 확보함
    - 접근성은 semantic primitive, Base UI, JSX a11y lint, Playwright와 axe 검사로 확보함
    - client JavaScript 절감은 App Router의 Server Component 기본값과 좁은 `use client` 경계로 확보함
    - UI 소유권은 공용 primitive·token을 `packages/ui`, 제품 조합·문구·상태를 `apps/web`에 두어 확보함

### arc42 2 · 기술과 조직 제약을 변경 전에 확인함

- **루트 `package.json`은 저장소 전체 orchestration만 소유하며 단일 workspace 명령의 전달 별칭을 만들지 않음**
    - 단일 workspace는 `bun run --filter <package-name> <script>` 형식으로 실행함
    - package script를 실행할 때는 시스템 명령과의 충돌을 막기 위해 `run`을 생략하지 않음
    - 공통 버전은 루트 `package.json#workspaces.catalog`에 고정하고 내부 package는 `workspace:*`로 연결함
- **Web 코드를 변경하기 전 설치된 Next.js 버전의 로컬 문서를 우선 확인해야 함**
    - `apps/web/AGENTS.md`는 현재 Next.js의 breaking change 가능성 때문에 `apps/web/node_modules/next/dist/docs/`를 기준으로 작업하도록 요구함
    - 온라인 공식 문서는 개념과 최신 공개 설명에 유용하지만 실제 코드 변경은 lockfile에 설치된 버전과 로컬 문서가 우선함
- **공개 패키지는 ESM과 명시적 subpath만 지원하며 root barrel과 CommonJS 호환 계층을 추가하지 않음**
    - `packages/ui`와 `packages/tooling`은 `tsc`로 ESM JavaScript와 declaration을 생성함
    - Web workspace에서는 TypeScript path와 package의 `source` condition으로 소스를 직접 검사함
    - 외부 게시물은 고정 `1.0.0`을 교체하는 개인용 mutable snapshot이며 일반적인 SemVer 불변성을 제공하지 않음
- **기존 작업 트리의 변경은 다른 사람의 작업으로 간주하고 관련 없는 파일을 되돌리거나 포맷하지 않음**
    - 작업 시작과 종료에 `git status --short`와 `git diff --check`를 실행함
    - snapshot·coverage baseline·lockfile은 실패를 없애기 위한 용도로 무조건 갱신하지 않음

### arc42 3 · C4 Context로 외부 관계를 확인함

- **시스템 경계는 공개 Web 서비스, 소스 저장소, 공유 package 배포 계약을 함께 포함함**
    - 방문자 트래픽은 배포된 Next.js 앱으로 들어감
    - 기여자의 변경은 GitHub와 CI를 거쳐 검증됨
    - 외부 소비자는 Web이 아니라 GitHub Packages에서 두 package를 받음
    - PlantUML 다이어그램은 정적 이미지가 아닌 Kroki URL을 통해 브라우저에서 렌더됨
- ![jongminchung 시스템 컨텍스트 C4 Level 1](https://kroki.io/plantuml/svg/eNptlFtPGkEUx9_5FKc8aUK8JD42jRatmHohXLR9MogTXF12Lbtr9A0FjPUSTQp2MavdJrRigwmKCk31hY_DzHyHnlm5eXkgy8zu-f_PmfObM6zpkYRuxGXXG0mJysYigbfeoX7v0LxXVXSyrr9zuXRJlwksq0osjt8sGUoM2J7Fdgs8YwH7V-SZA7HYrUG9Ct4hmCRrRIZBl2ty5PNMODQ_OfYhNB-YGPeFenpdLj9JaKrSsyZpkq4mPOCm5QtaqrGzIzcueM5q3F6y45t6lZmb-KQ_LfCpceKBEIkuwaga1TwwoawRTQf2YPLMEavZ9Nc98NQRS33luaK7t-URj0iKjj8ibBq1MvteQhtUtmx2nqSVG7ZjNn1DG6skGE1Iq0I1S79ZHpga_dRx8EB4Avh-kW8VMJTlk4CB9DDP81lhTivJxvXDo3lwQ9NJvKf7vNCgeykM3xsKzJEFoOUyPyzR0n2jcg_TKp4_N2s8b0Kjcot5djyFDdvexz2eM-luFuifIs3UqL2D8W3b-bF1vScm6UvGApqMS7rPWBB2InK3UK_6DVmGAPli4PnVqyNRXVIVDbcj0ZVIjGiOiW2hd3ctjugaSUSJjFKzzh-g5pHIYsY7AfRHmaeS7CwtnKYRmr5lzSmO5a7YabpZI6bdqNjgC4X8QWAnWXZ9KV6ya5P-Lr2wW0moKxLKfRRPoeuXI4oenpps9kdkGpwdF3hQe58eZOn55guRKBZnxJ32s3yN3iXFCdK_aeDZNEYy-xSpFeLD3e3pNyTR4Kd7uqrKkhJzMt4qsZOLRzNXgMgdlp_1vE1PE07h5JSPgSKum88XoaLIelXcjLTV5Mv92FIPIDyvSLTb7g9A4zrJt22H0x0TOe1whK_28friFS7w4xcptTSepYNyomqUe67jbmMGTZqaSk8V2vQ4WGyV2Z2FzDfJ6MYmHlEQxMUWXjielMWIrCrkVdkWJXSvwE5vcFw0qjV6VoRwADlJnbL01RN0VEwDusvtANI-PGSU2TkY7BvoGwC8MzSVYakqCIcTMY2wLV01ty6OQCHom5nDYTc-Nj2Kg26YKItirv4HFcR8BQ)
    - 수정 원본은 [`diagrams/onboarding-context.puml`](diagrams/onboarding-context.puml)임
- **Vercel Git 연동과 OCI image 배포 대상의 세부 설정은 저장소 밖에 있을 가능성이 있으며 문서의 연결선은 코드와 `vercel.json`·Dockerfile에 근거한 추론임**
    - 저장소 안 GitHub Actions의 `Web` workflow는 검증을 수행하지만 production 배포 명령은 포함하지 않음
    - 운영 변경 전 실제 Vercel project와 container registry·cluster의 소유자를 별도로 확인해야 함

### arc42 4 · 핵심 해결 전략을 코드 위치와 연결함

- **다중 제품을 세 앱으로 복제하지 않고 하나의 Next.js 앱과 Host proxy로 분리함**
    - 공개 Host는 `www.jamie.kr`, `tech.jamie.kr`, `invest.jamie.kr`이며 개발 Host도 같은 세 경계를 가짐
    - `proxy.ts`는 공개 URL을 `/home`, `/tech`, `/invest` 내부 route로 rewrite함
    - 내부 경로 직접 접근은 `404`로 차단해 구현 경계를 공개 API로 만들지 않음
- **읽기 중심 제품에 맞춰 Server Component와 파일 기반 콘텐츠를 기본값으로 사용함**
    - page와 layout은 기본적으로 서버에서 metadata와 콘텐츠를 준비함
    - 상태·event handler·browser API가 필요한 상호작용만 `use client` 경계로 분리함
    - 외부 데이터베이스나 CMS가 없으므로 콘텐츠와 코드가 같은 PR·검증·배포 단위를 가짐
- **공용 UI는 배포 가능한 package로 만들되 Web에서는 source-first로 연결함**
    - 빠른 내부 변경과 동일 graph typecheck는 `workspace:*`, `transpilePackages`, TypeScript path로 제공함
    - 외부 소비 계약은 package `exports`, peer dependency, build output과 dry-run으로 별도 검증함
- **다이어그램은 원본을 코드로 보존하고 제품 MDX에서는 build 네트워크 호출 없이 렌더 URL만 생성함**
    - 빌드는 PlantUML renderer의 가용성에 의존하지 않음
    - 실제 SVG 표시는 방문자의 Kroki 접근 가능성에 의존함

## 정적 구조·런타임·배포 구조를 따라감

### arc42 5 · C4 Container로 workspace 책임을 구분함

- **세 workspace와 콘텐츠·자동화의 책임을 섞지 않는 것이 유지보수의 핵심 경계임**
    - `apps/web`은 제품 route, 제품 component, 콘텐츠 domain rule, metadata와 배포물을 소유함
    - `packages/ui`는 제품 중립 primitive, `cn`, semantic token, 기본 theme와 Tailwind 진입점을 소유함
    - `packages/tooling`은 Oxfmt·Oxlint의 공유 설정 API를 소유함
    - `apps/web/content`는 사람이 수정하는 MDX 원본을 소유함
    - 루트 script와 GitHub Actions는 여러 workspace를 묶는 검증·게시 흐름을 소유함
- ![jongminchung 컨테이너 C4 Level 2](https://kroki.io/plantuml/svg/eNqNVd9PG0cQfr-_YuonUrmNFPFUVRWBOEDLL2GTtk_oOG_sje9urbs9wIoqOWAqFNyGStAYYlMjkQYqqrrYyZ0U-nJ_jnfvf-js2YApNMrTnXbnm_lm5pvZEZfrDvcsU_uE2obpZQl8OTZ8d2x4cYzZXKc2cb7SNE65SeAJs3MWWuU9Owfy_XG0UZWNjqhsQujD2DBMkWViwj1Nm7r__exCZnEq9TCzOD85PpEZuqNpc8RxmT20TF3KmZOEhGidiNNAHmwn7lxcWhiwFxTvu0FLvjzF-9CX9aZ8Uxbtjtys9QDpksuJtZha5UMFhxUo2n-jvgn8mTN1my9MT0H60TiIZlX8tCN-O70OKupGQc8RF83HKZ_wlmCuf6I8dFt12QhAnO3IegXsogUOyVGXOyX0cuFmlHl2VndKQw4psjipEkKvFUn8cSw2AtHcjF5gfHiqAVyWdWiFLKH9yCDgLp6p-DNklX_-BMnNE93gSciUiiRtOLTI1e0Ec7ncK4PJDN0kslEB8a6C1Yp2a912EyaYRUI_Q4x86E_ay8TlEO3tiJNOt30Ocqsunx9FG3VwmMeJeI1HzXq3_TbaPcbcBvkZ-EdsjJ6Q_9SijW0ZNEG-2hbtQJGYfvBdEr5Oz84kIbWKPGjW0VcS_bZtNkG1tlIPfRHsiMN61w9CP9pU3QSsSPQ8UAmIrSMUkPy1g9fi4DjOpN3pdso3yXj0Rq28uNkXFdKpuULtLIyl00kY1V0CC5MxnfZbVA8UHWpRTpexMi6xUB_UAM4KxEZxNSvy5Z-gyrJelo1zReP_asIZM6mdu8Glf64Czq4-tpDQ7Coe8AsG-ycQ1XblVkOF25XNZ6plstIAWTlSBx8IqXucWTqnzFadaJblwWv5YxWwkuLFHjZWhRj18HKGZUksmkeUY9OTgHNQWnFoLo__fZHfN5Qjt48Bufu3EoVCIr8g2qtBVD2O1o5w2mSjBt2zslw7Df3uWRWFE4vlsIV8eyx_0LR5Yl5NdE_QCMCmYodB9Xb_JFZsJjOXRoQyH5zxK4mhnJQiMCu51oLo50C--SXRG85bcL1IsYJD32BWkdnoJvSzTFmB4-G2us1HjLsK6hp51EKc5e8NiF5hE953oiputXPs02Er2q8q_EPP0rPMcAFJDjqKNekyzzHIZ4-pg3PmektFneeBIiMnbv4KcwouLhvyxaeD0Iuddbmq1CL9CwmXYWF-So2IfFf_b-UGldCrAMe9gDkYhdD3bIoFwBKRnBPbhP6SR81s6KfupW5xEJMfwCvJXEKK3pJJ3fwtsKsB-DisCjOwa1Pp6dDHEVXTJtY35LoPPW2pXNWeLTqMM4OZffhluOs--mPzMV609MTst_gUjadmHuAzNELsrHrt_gVy2Ahq)
    - 수정 원본은 [`diagrams/onboarding-containers.puml`](diagrams/onboarding-containers.puml)임
- **변경 위치는 재사용 횟수가 아니라 추상화 책임으로 결정함**
    - 제품 이름·locale 문구·site navigation·콘텐츠 의미가 있으면 `apps/web`에 둠
    - 제품과 무관한 상호작용 primitive·token schema이면 `packages/ui`에 둠
    - 여러 저장소가 공유할 정적 분석 정책이면 `packages/tooling`에 둠
    - root barrel로 편의를 만들기보다 명시적 subpath import로 의존 경계를 드러냄

### arc42 5 · C4 Component로 Web 내부 책임을 추적함

- **Web 요청은 proxy → route → domain rule → content repository·MDX loader → UI 순서로 해석함**
    - `app/`은 HTTP와 Next.js route convention을 소유함
    - `lib/`은 locale·routing·검색·콘텐츠 validation처럼 UI에 독립적인 규칙을 소유함
    - `components/`와 route group의 `_components/`는 제품 화면 조합을 소유함
    - `source.config.ts`와 `lib/fumadocs-source.ts`는 MDX compile·load 경계를 소유함
- ![Web 애플리케이션 내부 C4 Level 3](https://kroki.io/plantuml/svg/eNptVV1P40YUffevuPVTUgXyUB6rim1gl62guyJBu-1L5NhDmMqesewxAa0qZSFbsWwkQkuqQB0UHrpapFRKE1inKrzk59jj_1CNPxI--ubx3I_jc8-5XrSZYjHH0KUvMFF1R0PwdWEhX1goF6hhUoII-0aSGGY6gleoArzdC0-awcc-v6nz7hV_14Fg7yr4XIeJB4UFWEXbSIevJGn1yQ8vNkrl1eWnpfL682crpUxWkl4iy6Yks41tzKiVAzkYXAb9MT9vyVmpQAlTMEFWeXmHZSoWrdkoihk3g-4NPxvwXl3OgbxSWlvNwXqxAKayq1NFy4GqY0QYfKdsK0XVwiZ7VE6lhCHCciCvLb2eeMs7qqJjzVJqwP9oBaOxKKyYpp2voUp-Gjx9YzoVHauPqtpbioW0DZwDefEnSqoGJuqWQ6p5B4uC60hRGZgWNjDD24if1qGkYL2GiQaFYhH8UYO3b-WsdKfst9QhmmLtZmqo8qhsDVXkLLyRAKbTyZgW3dkVtFBb9KI7u6J19DDP7BzYmKE5izoMk-o8s-UkNPjzBraogSYeQ-rWxMNkG9ksuHAhbF_xRjdsd_xRD3SqKjoCC2nYQiqDoNMKDk_SmYuy4rJmYYZERX7QCX9_H7Y_ydl7IKNAOwfyE9OEdXGwkuSqRR3TTujPZwSkbER8PiOApc8xvPRk79oMGVmRpSu71GETz1SqaOLFNbcUounIEnwbiCmawpQIXM_1R9f_Aw6ZNBKkoLEQzx5mL6MueKqKudlNQudTx1A0qtqgUl1HKsOU8G4D_GGdf-wGLReCzwfBqA42UUx7izLu3gieg1E9PO08hqNRQ8FECP-oEVye8O4YfM_l_5ymQARHORBPgqH4KeYniogmNvFE-_33E0_4q-FCuN-KjuFBn5-3IHg3Dg_TwhHaUYPvDR6jMbSd2DRgYhPpmCDRxKaOpaJ5lZJNXI1ktpmQMJdcxdRsWpQwQ2EMWWICP1JNfHnMTKKwtaXX4ir2Cv_3KjzqB41meDgWkeLcbPLuzWNgjnAd77nhrwew8VzMWoBU0_uo_ewUC-fLfPl-gD-65m5vZtFIJheDsH2ZoEs2iz-89UeN6Pba5b80IRiecLcRjfG4J2elnyVpHemzzTZbXynxfP9t2Bnz82N-dilno-hp0F0P-4M6hEf9sP1JSIefnfDhX_HaK71M8pLwqakSN-ZjP-djQyeSENCDC1cgTXyaFEmzp3ITDgKDakifeKltUhmBPxz4o5sUTlwhzbznH3_Y5B9cAT2Ve0ToWTNteyc41tbMNSAgiEkGo3HQH4PA_ZubJEbBszUer23g3Vt_PBA5_LzF9wbAB2N-MXjwjZFWisjaRtbEK8QjnSoJwvYlb_ydpIjQO2v9oUBEJ7G6sWFSiz1oMxu6-EdNvPViYeLxRi_c7_Le21RLFUdsJ-Dd4-DDtVj-xZUXr8qry8-Wv1_KZKVFRDTxP_4P2HNK5Q)
    - 수정 원본은 [`diagrams/onboarding-web-components.puml`](diagrams/onboarding-web-components.puml)임
- **새 기능은 route에서 모든 로직을 작성하기보다 규칙의 수명에 맞는 계층으로 분리함**
    - HTTP parameter와 redirect·not-found는 route에 둠
    - 반복 계산과 validation·ranking은 `lib`의 순수 함수로 두고 Bun 내장 test runner로 검사함
    - 사용자 interaction과 시각 조합은 component에 두고 필요한 경우에만 client boundary로 만듦
    - 재사용 가능한 접근성 primitive가 없을 때만 `packages/ui`의 shadcn source workflow를 사용함

### arc42 6 · 문서 요청 런타임을 Server Component 관점으로 이해함

- **App Router의 page와 layout은 기본 Server Component이며 React가 서버 결과와 필요한 client 경계만 브라우저에 전달함**
    - [Next.js App Router 공식 문서](https://nextjs.org/docs/app)는 파일 기반 route와 Server Component 중심 모델을 설명함
    - [Next.js Server·Client Component 공식 문서](https://nextjs.org/docs/app/getting-started/server-and-client-components)는 상태·event·browser API가 있을 때만 Client Component가 필요한 이유를 설명함
    - [React Server Component 공식 문서](https://react.dev/reference/rsc/server-components)는 async server render와 client 상호작용 합성 모델을 설명함
- **production의 콘텐츠 repository는 한 번 생성한 불변 snapshot을 재사용하고 development는 변경을 즉시 반영하기 위해 매번 다시 생성함**
    - snapshot 생성 중 frontmatter, locale 쌍, inventory와 publication 규칙이 검증됨
    - MDX 본문은 Fumadocs의 async loader를 통해 필요한 page 단위로 로드됨
- ![문서 요청 런타임 시퀀스](https://kroki.io/plantuml/svg/eNptk89LG0EUx-_zVzw8tZAYWkoPAcViWy1VWuIPevAy7o66ZndmmX1b4y3UHLR6SCFWGnbTCtJWSCFoijm0F_-czOz_UGZMjJHe9jGf79v5vvedmQipxDjwCXroM1Dtnq4loJsNffEL1NdOtlfVrRpcXwGVzpPHUIo5egGDVY_tEEIdFBJU59zoWnWgEcQRkySkEj3HCylHUL0jlf7RzY7-VjXAuhQ795mJUIrK7iRGE4awxfj5szCEkoiRSQjpJrOYNPU4Nis4Mo4gWSgiD4XcvSFvy3H8ZRxQVzgRLD5_B76gLpOWD9zKGPhairJnDsrmgxDjEfLTQytFQOZsTW7TwGOTZVmwLW9GSAaIoa2tIsy9WIZCWViqsMEKnFVwO8o_errG50WE95oRq7ojN8yUQXLgC4f6bKosIDvu6lo6Yu1oilAw3H__pU4TkGxHesiIha3qdkxF6F_-7neSYR4ChtSlSEGfdrLmERmR93WhFG7soCc4RJyG0ZZA0K22_tDWzfM17rL3zBdhwDjqk7quJepjA9SPM3Wxb7D-RVV_T0c3CtxKcWDz-iry401Qlz3V7tllPXhIArcC-ZHfEqMO2mU6IggFZxxzsPxmNgcbUnAMKCKTw-539ze_vLiQg9LSLIR01_TOQXZc081GdpyA43smU-sxd302Wmh-2ma9OJiR_lKFbK-u9w5g5RVknxJ9mBAR4uDG-qQOb33KcWVxAdThmU67-nO3f9VTrZ867YJu7ev0iADcCYxNWxF02tN_G6pxruoJLK3OwUppYRgvuIHG3SytzhHGXTLDuGue9j_zXKC2)
    - 수정 원본은 [`diagrams/onboarding-request-sequence.puml`](diagrams/onboarding-request-sequence.puml)임
- **장애를 추적할 때는 요청 경계를 역순으로 좁힘**
    - Host가 `404`이면 `resolveSite`와 deployment Host 설정을 확인함
    - `/` locale redirect가 다르면 site별 cookie와 `Accept-Language`를 확인함
    - 문서가 `404`이면 publication status, locale 쌍, slug, Fumadocs collection을 확인함
    - build에서 콘텐츠가 실패하면 오류에 표시된 source path와 Zod·content validation을 확인함
    - 다이어그램만 보이지 않으면 page build보다 Kroki URL과 브라우저 network를 먼저 확인함

### arc42 7 · 두 Web 배포 방식과 package 게시를 구분함

- **Web은 Vercel managed output과 Next.js standalone container의 두 빌드 경계를 코드로 지원함**
    - `VERCEL=1`이면 Vercel adapter가 output을 구성하도록 `output: standalone`을 생략함
    - 그 외 build는 monorepo tracing root를 가진 standalone output을 생성함
    - `apps/web/docker/Dockerfile`은 Bun 1 Alpine, 비루트 `bun` 사용자, `PORT=3000`, multi-stage build를 사용함
    - `/healthz`는 공통 JSON health endpoint이며 Host rewrite보다 먼저 통과함
- **공유 package 게시와 Web 배포는 서로 다른 운영 흐름임**
    - `Publish Packages` workflow는 수동 실행되며 `tooling`, `ui`를 검사한 뒤 기존 `1.0.0`을 삭제하고 다시 게시함
    - Web의 `Web` workflow는 PR·main push·주간 schedule에서 typecheck·test·build·E2E 또는 콘텐츠 evidence를 수행함
    - `Links` workflow는 Markdown·HTML 로컬 링크를 검사함
    - `Waka Readme` workflow는 README 통계 구간을 갱신함
- ![배포 관점](https://kroki.io/plantuml/svg/eNp1VF1PE0EUfd9fce1TSaQU7ZMxBi2Ekig00MBjs90dysp2ZrM7WyCGpGI1iE1oYisfKVgTUTRNXBAtJvjSn9OZ_gfv1tIuNb5sJnPvOffOuefuhMNVm7s5U7llUM10dQL347GxeCw9SSyTbeQI5Q8UhRvcJCA8r7PbgPZFQdbL0GqCamuxOzDIhEWDrClKktgOo2Gd5InJLGLfhlD70pN7DXlcDo0oCxsOJ7n01DoPZw2-4mYwPm3whJsBWS_I4xP5qtRqPtS4waiD-cqgQHqW6SScJ7ZGTEQtdg8hPD1RqZolOjxyKYyD7VJu5EhoBJ4pAHFGuWpQYveAS8SviF_Q-8Q-xyxZ55GnDuR6XMzllsuBUZ811C8Hqq5anNhtrwDtHw1ZPOtUa-DTyeoZtrv5b8NMMxAuSgVZ3Ya5-Ax0Dvbb5799zn5zQ00PU2jXeYhheULHMi69Nx6JRaKjqmlhwCejjI7ajHHAILiOn5ycm0_B3Wg02uMNyoGzp7pqMkoGkgzugpIMbgFZUUY_KOtVWX8OOFS55bW_X4HlZkxDA1GpiPrrTtETnxri5ArQM53qqS-SeO91XuCEiygTwKYvVcAMGZutdXsOya2GPPyCxCAuS-LoSh566Iyb1rFJ1nC4vTEwT1LVVnFwXcvMEzPov77PLNdZaTWT863mGrNXl022ltYNx1K5toIwH3WdGvQKFgC554ndg94OiA81kD8rqIAon_7VomdcTHgHsvgRQ0OEw2pPMm2V2MuGSbpsRxfi26X8XADxqyTe1gDtJXZOfG7x9aV8U_Ol7i0gCoOtdA4qYqcCNyr3SvaVDD4iwXKk1UwRDQWYoXnidE2fSKWSC8Ow4Vb_Dx3r4sGgWZs4ztCLAyPijJmY1Gq6hjzah_FINBLF7SnL8wton5fwfV0Vt_d9jQOrv5CYW0o_npqemp0MjygThOr-v-oPzI3v5g)
    - 수정 원본은 [`diagrams/onboarding-deployment.puml`](diagrams/onboarding-deployment.puml)임
- **배포 전에는 [Next.js 배포 공식 문서](https://nextjs.org/docs/app/getting-started/deploying), [Vercel Next.js 공식 문서](https://vercel.com/docs/frameworks/full-stack/nextjs), [GitHub Packages npm 공식 문서](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)를 현재 운영 설정과 함께 확인함**
    - 공식 문서는 가능한 배포 방식을 설명하지만 실제 project ID·domain·rollback·registry retention은 저장소 밖 운영 설정이 최종 기준임

## 횡단 기술·결정·품질 기준을 적용함

### arc42 8 · React와 Next.js의 실행 경계를 이해함

- **React `19.2.8`은 component·JSX·state·effect·context의 UI 모델을 제공하고 Next.js가 server render와 routing을 조정함**
    - React component는 props를 받아 UI를 기술하는 순수 함수로 작성함
    - local interaction state는 `useState`, 외부 시스템 동기화는 필요한 경우에만 `useEffect`를 사용함
    - 상태를 component보다 높이 둘 때는 실제로 둘 이상의 하위 경계가 공유하는지 먼저 확인함
    - 공식 학습 순서는 [React Learn](https://react.dev/learn), [Thinking in React](https://react.dev/learn/thinking-in-react), [Hooks reference](https://react.dev/reference/react/hooks) 순서가 적합함
- **Next.js `16.3.1`은 App Router, Server Component, metadata, route handler, build와 standalone runtime을 제공함**
    - route group `(home)`, `(tech)`, `(invest)`, `(system)`은 URL에 나타나지 않고 코드 책임만 분리함
    - `[locale]`, `[slug]`, `[[...slug]]`는 동적·선택적 catch-all segment임
    - `page.tsx`는 화면, `layout.tsx`는 공유 UI, `route.ts`는 HTTP handler, `sitemap.ts`와 metadata 함수는 검색 노출 계약임
    - 공식 학습 자료는 [프로젝트 구조](https://nextjs.org/docs/app/getting-started/project-structure), [layout과 page](https://nextjs.org/docs/app/getting-started/layouts-and-pages), [route handler](https://nextjs.org/docs/app/getting-started/route-handlers-and-middleware) 문서임
- **React Compiler는 annotation mode이며 자동 최적화에 맡길 함수만 명시적으로 컴파일하는 정책임**
    - compiler를 우회하기 위한 습관적 `useMemo`·`useCallback` 추가보다 purity와 데이터 흐름을 먼저 바로잡음
    - `react/react-compiler`와 Hooks rule이 Oxlint error로 활성화됨
    - 공식 기준은 [React Compiler 문서](https://react.dev/learn/react-compiler)와 저장소의 `next.config.ts`임

### arc42 8 · Tailwind CSS와 UI 소유권을 이해함

- **Tailwind CSS `4.3.3`은 component 파일의 class를 스캔해 필요한 CSS를 build time에 생성하는 zero-runtime utility 체계임**
    - Web은 `@tailwindcss/postcss`를 `postcss.config.mjs`에 등록함
    - `packages/ui/src/styles/globals.css`는 `@import "tailwindcss" source(none)`로 자동 탐색을 끄고 `@source`로 허용 source를 명시함
    - test·spec 파일은 생산 CSS 후보에서 제외해 우연한 test class가 제품 bundle에 들어가는 것을 막음
    - 공식 자료는 [PostCSS 설치](https://tailwindcss.com/docs/installation/using-postcss), [source 탐지](https://tailwindcss.com/docs/detecting-classes-in-source-files), [theme 변수](https://tailwindcss.com/docs/theme) 문서임
- **semantic token은 색상값과 component class 사이의 안정된 의미 계층임**
    - `theme.css`는 light·dark의 실제 값을 제공함
    - `tokens.css`는 `--background`, `--primary` 같은 의미 변수를 Tailwind utility에 연결함
    - 앱의 `theme.css`는 제품별 override만 소유하며 primitive 내부에서 임의 색상값을 반복하지 않음
    - dark mode는 `html[data-theme="dark"]` 계약을 사용하며 `prefers-reduced-motion`을 존중함
- **`@jongminchung/ui`는 shadcn/ui의 생성 결과를 그대로 소비하는 package가 아니라 저장소가 소유하는 source library임**
    - shadcn CLI는 새 primitive의 시작점을 제공하고 생성된 코드는 접근성·token·API 계약에 맞게 검토함
    - Base UI는 dialog·popover·select 같은 headless interaction primitive를 제공함
    - `clsx`와 `tailwind-merge`를 합친 `cn`은 조건부 class와 충돌 해소를 담당함
    - 공식 자료는 [shadcn/ui monorepo](https://ui.shadcn.com/docs/monorepo), [shadcn CLI](https://ui.shadcn.com/docs/cli), [Base UI React](https://base-ui.com/react/overview/quick-start) 문서임
- **공유 primitive 추가는 dry-run → 실제 생성 → diff 검토 순서로 수행함**

```sh
bunx --bun shadcn add <component> --dry-run -c packages/ui
bunx --bun shadcn add <component> -c packages/ui
bunx --bun shadcn add <component> --diff -c packages/ui
```

### arc42 8 · TypeScript·콘텐츠·국제화 계약을 이해함

- **TypeScript `7.0.2`는 `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`로 경계를 강제함**
    - root·Web typecheck는 emit 없이 오류를 찾음
    - 공개 package build만 `tsconfig.build.json`을 통해 ESM JavaScript와 declaration을 emit함
    - type assertion으로 오류를 숨기기보다 외부 입력을 Zod나 type guard에서 좁힘
    - 공식 자료는 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/), [`strict` 옵션](https://www.typescriptlang.org/tsconfig/strict), [TSConfig reference](https://www.typescriptlang.org/tsconfig/)임
- **MDX는 Markdown 안에 JSX와 component를 사용할 수 있는 콘텐츠 형식이며 Fumadocs가 이를 type-safe collection으로 바꿈**
    - Tech Blog, Tech Docs, Invest Note는 서로 다른 collection과 metadata schema를 사용함
    - Fumadocs는 frontmatter, TOC, async body loader, page tree와 search source를 제공함
    - Zod는 build 전에 metadata와 registry가 기대한 모양인지 runtime에서 검증함
    - 공식 자료는 [MDX 개요](https://mdxjs.com/docs/what-is-mdx/), [Fumadocs MDX collection](https://www.fumadocs.dev/docs/mdx/collections), [Zod 문서](https://zod.dev/)임
- **한국어와 영어는 URL의 첫 segment와 metadata에 명시되며 `next-intl`은 request·provider message 계약을 제공함**
    - 공개 콘텐츠는 locale별 원본과 alternate page 관계를 유지해야 함
    - 사용자에게 보이는 공용 primitive 문구는 package에 영어 fallback으로 박지 않고 소비 site가 locale에 맞게 전달함
    - 공식 자료는 [next-intl App Router 문서](https://next-intl.dev/docs/getting-started/app-router)임
- **새 콘텐츠는 기존 같은 collection의 frontmatter와 template를 복사한 뒤 id·locale·날짜·출처·게시 상태를 의도적으로 결정함**
    - Tech Docs는 `apps/web/content/tech/docs/{ko,en}`에 작성함
    - Tech Blog는 `apps/web/content/tech/blog/{ko,en}`에 작성함
    - Invest Note는 `apps/web/content/invest/{ko,en}/notes`와 `content/invest/templates`를 기준으로 작성함
    - PlantUML은 Tech MDX의 `plantuml` fenced code block으로 작성하고 Excalidraw는 `public/diagrams` 자산 계약을 따름

### arc42 8 · 테스트·정적 분석·의존성 자동화를 이해함

- **Bun `1.4.0`의 내장 test runner는 TypeScript·JSX·mock·coverage를 별도 runner dependency 없이 실행함**
    - unit은 `*.test.ts(x)`, integration은 `*.integration.test.ts(x)`를 사용하며 같은 workspace process에서 실행함
    - Web은 공식 `fumadocs-mdx/bun` plugin을 preload해 실제 MDX collection을 로드함
    - coverage는 workspace별 `bunfig.toml`에서 파일별 line threshold와 LCOV 출력 위치를 관리함
    - 공식 자료는 [Bun test runner](https://bun.sh/docs/test), [Bun test 설정](https://bun.sh/docs/test/configuration), [Bun coverage](https://bun.sh/docs/test/code-coverage) 문서임
- **Playwright `1.62.1`은 production build와 standalone server를 띄워 실제 Host·route·브라우저 동작을 검사함**
    - Home·Tech·Invest project가 서로 다른 base URL을 사용함
    - visual snapshot은 animation과 caret을 통제하고 `0.001`의 pixel ratio 기준을 사용함
    - 실패 시 trace·screenshot·video가 CI artifact로 보존됨
    - snapshot 갱신 전 diff를 직접 확인하고 환경 차이인지 의도한 디자인 변경인지 판별함
    - 공식 자료는 [Playwright Test](https://playwright.dev/docs/intro), [visual comparison](https://playwright.dev/docs/test-snapshots), [Trace Viewer](https://playwright.dev/docs/trace-viewer) 문서임
- **Oxfmt·Oxlint·Knip은 형식, correctness·React·a11y 규칙, 미사용 파일·중복 export를 각각 담당함**
    - `bun run fmt`는 저장소를 수정하고 `bun run fmt:check`는 수정 없이 검사함
    - `bun run lint`는 type-aware rule을 포함한 공유 Oxc 정책을 적용함
    - `bun run deadcode`는 Knip의 file·duplicate 검사를 실행함
    - 공식 자료는 [Oxfmt](https://oxc.rs/docs/guide/usage/formatter), [Oxlint](https://oxc.rs/docs/guide/usage/linter), [Knip](https://knip.dev/overview/getting-started) 문서임
- **Renovate는 framework·UI·test·tooling lane별로 dependency PR을 묶고 major는 dashboard 승인을 요구함**
    - 공통 version은 catalog 한 곳에서 바꾸고 lockfile을 `bun install`로 재계산함
    - security override는 제거 조건과 upstream fix version을 남김
    - 공식 자료는 [Renovate 공식 문서](https://docs.renovatebot.com/)임

### arc42 9 · 이미 선택된 중요한 결정을 존중함

- **ADR과 코드에 반영된 결정은 편의만으로 되돌리지 않고 전제 변화와 migration·rollback을 새 결정 기록으로 남김**
    - 공개 TypeScript package build는 번들러 대신 `tsc`를 사용함
    - Web은 세 site를 단일 Next.js deployment로 제공함
    - 콘텐츠는 추적하는 원본과 build·runtime loader를 분리하며 별도 CMS를 두지 않음
    - UI는 source ownership 모델을 사용하며 shadcn registry 결과를 dependency처럼 자동 갱신하지 않음
    - package 게시의 mutable `1.0.0`은 제한된 개인 소비자만 전제로 함
- **새 ADR이 필요한 변경은 비가역성·비용·논쟁 가능성이 큰 경계 변경임**
    - site를 별도 deployment로 분리하는 변경임
    - CMS·database·authentication을 새로 도입하는 변경임
    - UI token schema나 package export를 깨는 변경임
    - package version 정책을 SemVer로 전환하는 변경임
    - 테스트 gate나 deployment platform을 교체하는 변경임
- **ADR은 상황 → 결정 → 대안 → 결과 → migration → rollback 순서로 작성하고 관련 코드와 문서를 같은 PR에서 연결함**
    - 현재 형식 예시는 [`adr/0001-node-library-tsc-build.md`](adr/0001-node-library-tsc-build.md)임

### arc42 10 · 품질 시나리오로 완료 조건을 정함

- **라우팅 정확성 시나리오는 지원 Host가 올바른 site로 연결되고 내부 경로와 알 수 없는 Host는 공개되지 않는 것임**
    - 검증은 `site-routing.test.ts`, `proxy.test.ts`, `proxy.e2e.test.ts`와 site별 E2E로 수행함
- **콘텐츠 신뢰성 시나리오는 잘못된 frontmatter·locale 쌍·게시 inventory가 build 전에 실패하는 것임**
    - 검증은 content model·validation test, Fumadocs validation script, Web build로 수행함
- **접근성 시나리오는 keyboard·focus·label·reduced motion·semantic structure가 component와 실제 page에서 유지되는 것임**
    - 검증은 UI test, JSX a11y lint, axe를 포함한 Playwright test로 수행함
- **성능 시나리오는 읽기 중심 page가 불필요한 client JavaScript를 보내지 않고 font·검색·초기 전송 기준을 유지하는 것임**
    - 검증은 Server Component 기본값, initial transfer E2E, font asset test, scheduled content evidence로 수행함
- **유지보수성 시나리오는 한 workspace 변경이 전체 저장소를 포맷하거나 다른 package의 비공개 구현에 의존하지 않는 것임**
    - 검증은 명시적 subpath, source condition, 가장 가까운 test와 root `check`로 수행함
- **배포 가능성 시나리오는 clean install에서 Web build와 standalone start가 성공하고 `/healthz`가 `200` JSON을 반환하는 것임**
    - 검증은 CI build·E2E와 container smoke test에서 수행해야 함

## 위험·용어·실행 가능한 유지보수 절차를 남김

### arc42 11 · 현재 위험과 기술 부채를 인지함

- **가장 큰 package 위험은 같은 `1.0.0`이 다른 내용과 integrity로 교체되는 mutable snapshot 정책임**
    - 외부 소비자는 `bun update --force <package>@1.0.0`으로 다시 resolve하고 lockfile을 커밋해야 함
    - 독립된 외부 소비자가 생기기 전 immutable SemVer·changelog·migration·rollback으로 전환할 필요가 있음
- **Web production 배포와 rollback의 실제 소유권이 저장소 안 workflow에 완전히 표현되지 않은 운영 위험이 있음**
    - Vercel Git integration, OCI registry, domain과 rollback runbook을 운영 시스템에서 별도로 확인해야 함
    - 배포 장애 대응 담당자와 마지막 정상 artifact를 문서화할 필요가 있음
- **Kroki 기반 다이어그램은 build를 막지 않지만 외부 서비스 장애·network policy에 따라 사용자 화면에서 보이지 않을 수 있음**
    - 중요한 운영 diagram은 `.puml` 원본을 반드시 함께 보존함
    - 완전한 독립성이 필요해지면 CI에서 SVG를 생성해 같은 PR에서 source와 결과를 검증하는 방식을 검토할 수 있음
- **빠르게 움직이는 framework version과 수동 문서 version이 어긋날 위험이 있음**
    - version 사실은 `.bun-version`, `.node-version`, `package.json`, `bun.lock`이 우선함
    - 의존성 PR은 onboarding의 version과 공식 release note link도 함께 검토함
- **단일 Web deployment는 재사용과 운영 단순성을 주지만 한 site의 build·runtime 결함이 세 site의 release를 함께 막을 수 있음**
    - site별 E2E와 route group 경계로 회귀 범위를 줄임
    - 독립 release 요구가 생기면 deployment 분리의 비용·cache·domain·공유 코드 전략을 ADR로 검토해야 함

### arc42 12 · 저장소 용어를 같은 의미로 사용함

- **Workspace**는 루트 `package.json#workspaces.packages`에 등록된 독립 package 단위임
- **App Router**는 `app/`의 폴더와 특수 파일로 route·layout·server render를 정의하는 Next.js router임
- **Server Component**는 기본적으로 서버에서 실행되어 client JavaScript graph에 포함되지 않는 React component임
- **Client Component**는 `use client` entry 아래에서 state·event·browser API를 사용할 수 있는 component임
- **Route group**은 `(tech)`처럼 URL에는 나타나지 않고 코드 구조와 layout 경계를 만드는 폴더임
- **Rewrite**는 브라우저 URL을 유지한 채 서버 내부 route를 바꾸는 동작이며 redirect와 다름
- **MDX**는 Markdown과 JSX·ES module 표현을 결합한 콘텐츠 형식임
- **Fumadocs collection**은 MDX 파일 집합에 schema·compile·loader·page tree 계약을 부여한 단위임
- **Semantic token**은 `primary`, `muted`, `border`처럼 실제 색상보다 UI 의미를 나타내는 CSS 변수임
- **Primitive**는 제품 문구와 업무 의미를 갖지 않는 접근성·상호작용 중심 UI 부품임
- **Product component**는 site navigation·문서 카드·투자 노트처럼 제품 의미와 조합을 소유하는 component임
- **Source-first**는 workspace 개발에서 package의 build 결과보다 TypeScript·CSS 원본을 직접 resolve하는 방식임
- **Catalog**는 여러 workspace가 사용할 외부 dependency version을 루트 `package.json#workspaces`에서 중앙 관리하는 기능임
- **Unit·Integration·E2E**는 각각 순수 규칙·실제 filesystem과 pipeline·build된 브라우저 경계를 검사하는 test 수준임
- **Snapshot**은 visual 기준 이미지 또는 production에서 재사용하는 불변 콘텐츠 모음이며 문맥에 따라 구분해야 함
- **Mutable package snapshot**은 동일 version을 덮어쓰는 현재 개인용 GitHub Packages release 정책임

### 변경 유형별 최소 실행 절차를 적용함

- **모든 변경은 기존 작업 확인 → 가장 가까운 검사 → 저장소 gate → diff 범위 확인 순서로 닫음**
- ![변경 검증 흐름](https://kroki.io/plantuml/svg/eNp9Uj1P6zAU3f0r7ggDC2JKB5DeH-CB9JjT1GmtmrZKblR1yxAhPirB8Arlqa2KVPoYOlRNUcrAkp8TO_8BOyRQEDBYtq_uPef4-Oy5aDroHXOCDDkFEfrJ4hmShS-nQ0iHV2IaQByB6Vg72_DbMznDDvxhtE1INkqMKkNQR_RccTeAZDWXd8sCJ73tyeGqRIz8Lk-6cjCGdtOpuy3TovLWV1zPSRiAvBiKMCgRwmzYELOVDAbifzcHSnsPu5uANdqADdk_3SQARtlrgKOWfYyGVaNWvbRe5axRd4s65S5Vg71AXJzK_iQbT-a-HN2D2pKnrvy3BOy0aNYfR0hdVIIm6fWZBtWKDqhpYRz9OjyMI6fpYWGVHAWflWnwpS_GD3BEy1D2GK_E0T43O22HVWvrwLRRYXZOkISP2hrlSt2s_oxe9OTQWq02UrMpg8VT8P6WL8jeLCrMyeqvtk-XYjqT55M4EvN5ejmLoyQcy0GQ3vS_V_QR0LA9zj98helVGL7xZHlRJxu2tnIFaxFSRbfWdFBHSSz-KmqQo1kRIxebLbKngHRgXwDy9Dua)
    - 수정 원본은 [`diagrams/onboarding-change-flow.puml`](diagrams/onboarding-change-flow.puml)임
- **Markdown·일반 문서 변경은 형식과 로컬 링크를 검사함**

```sh
bun run fmt:check
bun run links:check
git diff --check
```

- **React·CSS·Web domain rule 변경은 typecheck·unit test와 관련 E2E를 실행함**

```sh
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/web test
bun run --filter @jongminchung/web build
bun run --filter @jongminchung/web test:e2e
```

- **공유 UI 변경은 package와 소비 Web을 함께 검사함**

```sh
bun run --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/ui test
bun run --filter @jongminchung/ui build
bun run --filter @jongminchung/web typecheck
```

- **공유 tooling 변경은 package API와 실제 root 소비 설정을 함께 검사함**

```sh
bun run --filter @jongminchung/tooling typecheck
bun run --filter @jongminchung/tooling test
bun run --filter @jongminchung/tooling build
bun run lint
bun run fmt:check
```

- **의존성 변경은 lane을 하나로 제한하고 manifest·catalog·lockfile·release note를 함께 검토함**

```sh
bun outdated --recursive
# 루트 catalog 또는 대상 package.json 변경
bun install
bun run check:full
bun run audit
```

- **저장소 전체 기본 gate와 고위험 gate를 구분함**
    - `bun run check`는 format, lint, typecheck, deadcode, unit, integration을 실행함
    - `bun run check:full`은 기본 gate 뒤에 build와 Playwright E2E를 실행함
    - `bun run audit`는 registry advisory database가 필요하므로 네트워크 의존 gate로 별도 실행함
    - `bun run links:check`는 고정 Lychee container로 Markdown·HTML의 로컬 link와 anchor를 검사함

### 첫 기여를 작은 수직 변경으로 완료함

- **첫 PR은 한 경계를 끝까지 경험할 수 있는 작고 되돌릴 수 있는 변경이 적합함**
    - Tech Docs 오탈자와 양 언어 metadata 검증임
    - 순수 `lib` 함수의 edge case와 unit test 추가임
    - 기존 primitive를 사용한 작은 접근성 수정과 관련 Playwright assertion 추가임
    - 오래된 공식 문서 URL 갱신과 `links:check` 실행임
- **첫 PR 설명에는 목적, 변경 경계, 사용자 영향, 실행한 명령, 실행하지 못한 검증과 이유를 기록함**
    - visual 변경이면 before·after와 snapshot diff 판단을 포함함
    - dependency 변경이면 lane·release note·migration·rollback을 포함함
    - architecture 경계 변경이면 ADR 필요 여부를 포함함
- **첫 주의 학습 순서는 실행 가능한 결과를 기준으로 구성함**
    - 1일차에는 세 Host와 locale redirect를 실행하고 C4 Context·Container를 설명할 수 있어야 함
    - 2일차에는 하나의 Tech Docs request를 proxy부터 MDX component까지 추적할 수 있어야 함
    - 3일차에는 Tailwind token과 shared primitive·product component의 소유권을 구분할 수 있어야 함
    - 4일차에는 unit·integration·E2E 실패 artifact를 읽고 적절한 최소 검사를 선택할 수 있어야 함
    - 5일차에는 작은 수직 변경을 `bun run check`와 필요한 추가 gate까지 통과시킬 수 있어야 함

## 결론과 실행 제안

- **지금 바로 `bun install --frozen-lockfile`과 Web 개발 서버를 실행하고 Home·Tech·Invest 세 Host를 확인하는 것이 첫 단계임**
- **그다음 `proxy.ts`에서 Tech Docs page까지 한 요청을 추적하고 C4 Component 그림의 각 상자를 실제 파일과 대응시키는 것이 두 번째 단계임**
- **첫 변경은 하나의 workspace에 제한하고 가장 가까운 검사 뒤 `bun run check`를 실행하는 것이 안전한 완료 기준임**
- **architecture·package export·배포·데이터 원천을 바꾸는 제안은 구현 전에 arc42 품질 목표와 위험을 갱신하고 ADR로 결정하는 것이 필요함**
- **의존성이나 실행 계약이 바뀔 때 이 문서의 version·공식 링크·다이어그램·명령을 같은 PR에서 갱신해야 문서 단독 온보딩 가치가 유지됨**
