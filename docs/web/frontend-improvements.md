# 프론트엔드 개선 기록

- 기준일은 2026-09-05이며 현재 작업 트리의 구현과 로컬 검증을 기록함
- 검색창 JavaScript를 최초 열기 시점으로 분리하고 첫 화면 이미지의 로딩 우선순위를 명시함
- 영문에 작은 가변 폰트를 우선 적용하고 나머지 문자는 기존 dynamic subset으로 보완함
- 문서 CSS의 사용 범위를 줄이고 검색창 초점 제어를 공용 UI primitive에 위임함
- 번역 메시지의 namespace·key·locale을 TypeScript에서 검증함

## 반영한 제품 코드 개선

| 영역            | 변경                                                                 | 사용자·유지보수 영향                                                           |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Next.js         | 검색창을 `next/dynamic`으로 로드하며 기존 `preload={false}`를 유지함 | 검색하지 않는 방문자의 초기 JavaScript에서 검색창 모듈을 분리함                |
| Next.js 링크    | 카드의 미리 읽기를 포인터·키보드 초점 시점에 시작함                  | 이미지 로딩 우선순위와 문서 전체 미리 읽기를 분리하여 초기 CSS·RSC 전송을 줄임 |
| 이미지          | 첫 화면 이미지의 `eager` 옵션을 실제 `loading`과 연결함              | 높은 fetch priority와 지연 로딩이 동시에 적용되던 모순을 제거함                |
| 폰트            | 영문 Latin·기호·한국어 전환 라벨 subset을 먼저 사용함                | 영문 기호 하나 때문에 한글이 포함된 큰 subset을 요청하는 경우를 줄임           |
| React·shadcn/ui | 검색창에 `Base UI`의 `initialFocus`·`finalFocus`를 사용함            | 초점 이동의 effect·ref·animation-frame 중복 제어를 줄임                        |
| TypeScript      | `next-intl`의 `AppConfig`를 메시지 원본으로 보강함                   | 잘못된 namespace·key·locale을 컴파일 단계에서 발견함                           |
| Tailwind        | 공용 코드블록 CSS와 Tech의 Docs layout CSS를 구분함                  | 사용하지 않는 Home·Notebook·Flux layout의 utility 생성을 제외함                |
| MDX             | 데이터 추출용 CLI에서 렌더링 전용 구문 강조를 생략함                 | 콘텐츠 검사와 Next 빌드 사이의 중복 작업을 줄임                                |

- [검색창 로딩](<../../apps/web/app/(tech)/_components/SearchPalette.tsx>), [검색창 UI](<../../apps/web/app/(tech)/_components/SearchDialog.tsx>), [이미지](../../apps/web/components/EditorialImage.tsx), [폰트 재생성](../../apps/web/app/fonts/README.md)에 구현 경계를 기록함
- Invest 코드블록 CSS는 노트 본문의 layout으로 옮겨 노트 목록 링크의 미리 읽기에 포함되지 않도록 함
- [코드블록 CSS](../../apps/web/app/mdx-theme.css)는 Web 앱이 소유하며 공용 `packages/ui`에 제품별 스타일을 추가하지 않음
- `@fumadocs/tailwind`는 기존 전이 의존성 0.1.1을 직접 선언하여 사용한 typography plugin의 의존성을 명시함
- 데이터 추출 모드는 `JAMIE_MDX_METADATA_ONLY=1`인 CLI에만 적용하며 실제 Next 페이지에는 원래 구문 강조를 유지함
- 폰트 파생본은 `Jamie Latin`으로 명명하며 원본 저작권·라이선스와 가변 weight·hinting을 보존함
- 공식 API 근거는 [Next lazy loading](https://nextjs.org/docs/app/guides/lazy-loading), [Base UI Dialog](https://base-ui.com/react/components/dialog), [next-intl TypeScript](https://next-intl.dev/docs/workflows/typescript), [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)임

## 함께 마무리한 운영 정리

- 삭제된 파일로 향하는 문서 링크를 제거하고 완료된 0040 이슈를 아카이브로 이동함
- 주간 콘텐츠 보고서의 업로드 경로를 workspace의 실제 출력 경로로 수정함
- 보고서 파일이 누락되면 artifact 단계가 실패하도록 명시함
- 글 목록의 이미지 검사는 새 글 추가로 대상이 다음 페이지로 이동해도 탐색하도록 수정함
- 전체 MDX corpus를 처리하는 검색 통합 검사에 제한된 별도 시간 예산을 부여함

## 1차 개선 당시 브라우저 전송량

- Chromium의 새 context에서 `networkidle`·`document.fonts.ready` 이후 측정한 값이며 단위는 bytes임
- 영문 Tech 폰트 전송량은 이전 [실패 CI](https://github.com/jongminchung/jongminchung/actions/runs/33891316800)의 136,060에서 45,176으로 약 66.8% 감소함
- 영문 세 사이트는 폰트 요청 1개를 사용하며 한국어의 기존 92개 subset은 유지함

| 경로      | 폰트 전송 | CSS 전송 | JavaScript 전송 |
| --------- | --------: | -------: | --------------: |
| home/en   |    45,176 |   35,189 |         199,574 |
| home/ko   |   380,088 |   35,189 |         199,574 |
| tech/en   |    45,176 |   46,720 |         272,483 |
| tech/ko   |   339,656 |   46,720 |         272,483 |
| invest/en |    45,176 |   33,662 |         233,121 |
| invest/ko |   399,204 |   33,662 |         233,121 |

- 한국어 Tech·Invest의 예산은 현재 콘텐츠에 필요한 glyph 조합을 재측정해 약 4–5% 여유를 반영함
- 이 값은 초기 자산 전송량이며 실제 사용자 환경의 LCP·INP 개선율을 뜻하지 않음
- 코드블록 기본 utility는 `components` layer에서 생성하여 앱의 반응형 utility를 덮어쓰지 않도록 함

## 1차 개선 검증

- `bun run check`를 통과했으며 Web 167개·UI 13개·Tooling 14개 테스트와 Node ESM consumer 검사를 포함함
- `PLAYWRIGHT_TEST=1 bun run --filter @jongminchung/web build`로 프로덕션 빌드를 확인함
- `bun run --filter @jongminchung/web test:e2e --workers=2`에서 82개 테스트가 모두 통과함
- 기준 화면 12개를 전후 비교하고 콘텐츠·탐색 UI 변경이 반영된 10개 snapshot을 갱신함
- 영어 검색창 chunk가 Tech의 초기 JavaScript 요청에 포함되지 않음을 확인함
- `shadcn info`의 Web·UI 설정 확인과 문서 링크 검사를 통과함
- 주간 보고서를 실제 workspace 경로에 생성하여 144개 콘텐츠 항목이 기록됨을 확인함
- 측정 환경은 Bun 1.4.1·Node 26.8.1·Playwright 1.62.1의 Chromium이며 원격 CI 재실행이나 배포 결과를 뜻하지 않음

## 후속 개선: Tech CSS 경계

- [공통 CSS](<../../apps/web/app/(tech)/tech.css>)에서 코드블록·typography plugin·쇼케이스 애니메이션을 분리함
- [본문 CSS](<../../apps/web/app/(tech)/tech-document.css>)는 Blog의 `[slug]` layout에서, [Docs CSS](<../../apps/web/app/(tech)/tech-docs.css>)는 Docs layout에서 로드함
- Blog는 공용 코드블록 스타일을 사용하고 Docs는 여기에 Fumadocs typography를 추가함
- [쇼케이스 CSS](<../../apps/web/app/(tech)/tech-showcase.css>)는 `ShowcasePage`에 연결하고 reduced-motion 동작을 유지함
- [상단 탐색](../../apps/web/components/EditorialChrome.tsx)의 일반 링크에도 기존 `IntentLink`를 사용함. 기본 prefetch가 분리한 쇼케이스 CSS·JavaScript를 목록에서 다시 요청하던 경로를 줄임
- Fumadocs의 `generated/docs.css`·`generated/shared.css`는 utility 후보 목록이므로 공통 stylesheet에서 계속 생성함. 이를 문서의 `components` layer로 옮기면 공통 utility와 반응형 utility의 우선순위가 달라져 모바일 목차·데스크톱 sidebar가 바뀌는 것을 브라우저 검사에서 확인함
- Docs 본문에는 `prose-no-margin`을 명시하여 첫·마지막 자식의 여백을 유지함. Docs 인용문도 기존 typography의 `1.6em` 여백을 명시해 CSS layer가 바뀌어도 Blog의 `my-7`과 구분되는 읽기 리듬을 보존함
- 코드블록의 기본 utility는 기존과 같이 `components` layer에 두고 앱 utility가 우선하도록 함. `@reference`가 가져오는 UI source를 본문 CSS에서 제외하여 중복 생성을 줄임
- 목록 → 검색 결과 → Docs → 뒤로 가기 전환에서 문서 CSS 로드와 header 높이·배경·위치 유지를 검사함
- [Next.js CSS 안내](https://nextjs.org/docs/app/getting-started/css)에 따라 프로덕션 빌드의 병합 결과와 페이지 전환 후 남아 있는 CSS를 함께 검증함. Docs layout utility 전체를 경로별로 분리한 상태는 아님

### 후속 개선 후 브라우저 전송량

- 위 1차 측정과 같은 viewport 1440×1000, Chromium 새 context, `networkidle`·`document.fonts.ready` 조건을 사용함
- `PLAYWRIGHT_TEST=1` 프로덕션 standalone 서버의 `PerformanceResourceTiming.transferSize` 합계이며 단위는 bytes임

| 경로      | 폰트 전송 | CSS 전송 | JavaScript 전송 |
| --------- | --------: | -------: | --------------: |
| home/en   |    45,176 |   35,189 |         199,574 |
| home/ko   |   380,088 |   35,189 |         199,574 |
| tech/en   |    45,176 |   43,894 |         248,472 |
| tech/ko   |   339,656 |   43,894 |         248,472 |
| invest/en |    45,176 |   33,662 |         233,131 |
| invest/ko |   399,204 |   33,662 |         233,131 |

- Tech 목록의 CSS는 46,720 → 43,894로 2,826 bytes·6.0%, JavaScript는 272,483 → 248,472로 24,011 bytes·8.8% 감소함
- 목록의 CSS 요청 3개에는 Shiki 규칙·쇼케이스 keyframes가 없음을 확인함. 검색창은 초기 요청에 포함되지 않으며 Compiler 적용 코드는 지연 로드되는 검색창 chunk에 생성됨
- Tech 목록의 decoded CSS는 229,138 bytes, decoded JavaScript는 781,380 bytes임
- [전송 예산](../../apps/web/initial-transfer-budget.json)을 Tech의 CSS 46,000·decoded 240,000, JavaScript 260,000·decoded 820,000 bytes로 좁혀 약 5% 여유로 회귀를 감지함

| 직접 방문한 영문 경로           | CSS 요청 수 | CSS 전송 | Shiki | 쇼케이스 keyframes |
| ------------------------------- | ----------: | -------: | ----- | ------------------ |
| `/en`                           |           3 |   43,894 | 없음  | 없음               |
| `/en/docs/fe/nextjs-16`         |           4 |   48,813 | 있음  | 없음               |
| `/en/the-expensive-main-thread` |           4 |   47,372 | 있음  | 없음               |
| `/en/showcase`                  |           4 |   44,572 | 없음  | 있음               |

- CSS 분리로 본문 방문 시 추가 stylesheet 요청 1개가 발생함. 위 값은 각 경로의 새 context 측정이며 방문 기록에 따라 누적되는 CSS 전송량과 구분함
- 최초 진입 자산량의 변화이며 실제 사용자 LCP·INP의 개선율을 뜻하지 않음

## 후속 개선: React Compiler 적용 범위

- `annotation` 모드를 유지하고 [SearchDialog](<../../apps/web/app/(tech)/_components/SearchDialog.tsx>)에만 `use memo`를 추가함. 기존 `BrandWordmark`를 포함해 적용 함수는 2개임
- `query` 자체 대신 표시 개수인 `resultLimit`을 결과 변환의 `useMemo` 의존성으로 사용함. 빈 검색은 8개, 검색어가 있으면 32개를 표시하며 같은 응답을 유지하는 입력 구간에 배열을 재생성하지 않음
- 검색 client·재시도 의존성·결과 변환의 기존 `useMemo`는 유지함. [React Compiler 안내](https://react.dev/learn/react-compiler/introduction)의 기존 memoization 유지 권장과 [점진적 적용](https://react.dev/learn/react-compiler/incremental-adoption)을 따름
- 검색 응답·locale·번역 함수·표시 개수가 바뀌면 결과를 다시 계산함. 검색 결과 갱신·선택·오류 재시도·닫기·초점 복귀 동작을 검증함
- `EditorialNavigationMenu`와 `EditorialMobileNavigation`은 코드 검토 결과 열림 상태가 하위 Base UI에 있음. 상위 함수에 Compiler를 추가했을 때 실제 열기·닫기 비용이 줄어드는 근거가 없어 이번 범위에서 제외함

### 검색 렌더링 측정 방법

- 실제 `SearchDialog` 소스 3종을 비교함: 1차 개선 commit `1739dcccece2`의 코드, `resultLimit`만 반영한 코드, 여기에 `use memo`를 추가한 코드
- Compiler 1.0.0의 `annotation` 변환에서 `SearchDialog`의 `CompileSuccess`, memo slot 63개·memo block 20개를 확인함. Next 프로덕션 검색창 chunk에서도 cache 분기 생성을 확인함
- 결정적인 반복 횟수 검사는 React·happy-dom 환경에서 UI·검색 hook을 대역으로 교체하고, 같은 32개 결과를 유지한 채 비어 있지 않은 검색어를 10회 바꿈. 최초 mount를 제외한 결과는 아래와 같음

| 변형                     | 결과 변환 호출 | 결과 행 렌더링 |
| ------------------------ | -------------: | -------------: |
| 기존 코드                |             10 |            320 |
| `resultLimit`만 반영     |              0 |            320 |
| `resultLimit` + Compiler |              0 |              0 |

- 대역 기반 횟수는 실제 UI 전체의 렌더링 횟수를 의미하지 않음. 응답을 새 배열로 바꾸면 마지막 결과까지 갱신되고 결과 선택 URL도 유지되는 것을 별도로 확인함

### 실제 UI의 브라우저 Profiler 측정

- Chromium 151·React 19.2.8의 production profiling renderer에서 실제 Base UI·cmdk·next-intl·`useDocsSearch`를 렌더링함. Next 전체 페이지 대신 `SearchDialog`를 독립 번들로 구성하고 router provider와 고정 검색 응답을 제공함
- CPU 4배 throttling, 결과 32개를 표시한 뒤 `warm`에 숫자 10개를 5ms 간격으로 입력함. 다음 응답은 1.5초 지연시켜 입력 중 기존 결과를 유지하고, 최초 mount를 제외한 20개 commit의 `Profiler.actualDuration`을 합산함
- 다른 빌드·E2E 실행이 없는 상태에서 각 변형을 5회 실행하고 순서를 번갈아 바꿈. 단위는 ms임

| 변형                     | 5회 렌더링 시간 합계                  | 중앙값 |
| ------------------------ | ------------------------------------- | -----: |
| 기존 코드                | 133.5 / 133.0 / 153.7 / 130.1 / 133.0 |  133.0 |
| `resultLimit`만 반영     | 149.8 / 147.1 / 144.7 / 151.2 / 139.2 |  147.1 |
| `resultLimit` + Compiler | 41.8 / 37.5 / 45.4 / 35.3 / 51.3      |   41.8 |

- Compiler 적용 변형의 중앙값은 기존 코드보다 약 68.6% 낮았음. 결과 배열의 재계산만 없애서는 실제 UI 시간이 줄지 않았으므로 결과 행 JSX까지 재사용하는 범위로 적용함
- 실제 UI commit 수는 줄지 않았으며, 대역 기반 결과 행 0회와 구분함. [React Profiler](https://react.dev/reference/react/Profiler)의 렌더링 시간이며 layout·paint·네트워크 대기·사용자 INP를 측정한 값은 아님
- 위 측정 harness와 대역은 로컬 검토에만 사용했으며 제품 코드나 CI의 시간 임계값에 포함하지 않음

## 후속 개선: 검색 응답 타입 단언 축소

- 검색 결과의 breadcrumb 문자열을 `DocumentKind`로 단언하던 코드를 제거하고 [isDocumentKind](../../apps/web/lib/tech/document-kind.ts)로 판별함
- 문서 유형 목록·타입·판별 함수·번역 라벨을 가벼운 모듈에 함께 둠. 서버 `content-model.ts`의 Zod enum도 같은 목록을 사용하여 서버와 클라이언트가 허용하는 유형을 일치시킴
- [검색 결과 변환](../../apps/web/lib/tech/search-results.ts)을 UI에서 분리함. 알려진 4개 유형은 현지화하고 `Docs`·미래 유형·빈 문자열·객체 속성 이름은 `Docs`로 표시함. `Blog` 및 breadcrumb가 없는 기존 응답은 기존 Blog 표시를 유지함
- heading → text → page 순서의 대표 일치 선택, `<mark>` 제거, breadcrumb 그룹, anchor URL 보존을 검증함
- 브라우저 번들 확인에서 결과 변환의 runtime 입력은 `search-results.ts`·`document-kind.ts` 2개뿐이며 Zod·서버 콘텐츠 schema가 포함되지 않음. esbuild minify 단독 번들 크기는 979 bytes로, Next 전송량과는 별도 측정임
- 외부 JSON 전체의 runtime schema 검증을 추가한 것은 아님. 이번 범위는 기존 `SortedResult` 계약 안에서 자유 문자열인 breadcrumb를 안전하게 분류하는 경계임

## 후속 개선 최종 검증

- `mise exec shfmt@3.12.0 -- bun run check` 통과: format·lint·typecheck·deadcode, Web 171개·UI 13개·Tooling 14개 테스트, Node ESM consumer 검사를 포함함
- `PLAYWRIGHT_TEST=1 bun run --filter @jongminchung/web build`로 프로덕션 빌드를 확인함
- 빌드한 standalone 서버에서 `bun run --filter @jongminchung/web test:e2e --workers=2`의 84개 테스트가 모두 통과함
- 기준 화면 12개를 갱신하지 않고 통과함. Docs 모바일 목차·sidebar, 본문 typography, Blog·Docs 탐색, 검색의 재시도·이동·초점 복귀를 포함함
- 새로 좁힌 전송 예산을 6개 초기 경로에서 통과하고 검색창 chunk가 영문·한글 Tech 목록의 초기 요청에 없음을 확인함
- 이 문서의 로컬 파일 링크와 `git diff --check`를 확인함
- 환경은 Bun 1.4.1·Node 26.8.1·Playwright 1.62.1·Chromium 151.0.7922.34임. 이 환경에 없던 Chromium 시스템 의존성과 저장소가 지정한 shfmt 3.12.0을 설치하여 검사함
- 로컬 작업 트리 검증이며 원격 CI·배포 결과를 뜻하지 않음

## 남은 개선 우선순위

1. **문서 utility의 중복과 로딩 순서 검토**
    - 현재 분리한 본문 CSS의 전송량과 Docs layout utility의 공통 생성 비용을 함께 줄이는 방향을 검토함
    - 추가 분리는 모바일 TOC·sidebar, 다크 모드, Blog↔Docs 전환을 기존 snapshot 갱신 없이 통과하는 조건으로 진행함
2. **검색 실사용 상호작용 측정**
    - 이번 Compiler 범위는 검색 입력 중의 반복 렌더링에 한정함. 실제 네트워크 지연·기기에서 검색창 열기·입력·선택의 INP와 응답 대기 시간을 구분하여 측정할 필요가 있음
    - 탐색 메뉴는 상위 wrapper의 재렌더링 병목이 확인될 때 적용 범위를 재검토함
3. **Tailwind·shadcn/ui 제품 variant 정리**
    - 반복 카드·목록의 레이아웃 선택을 명시적 variant로 정리하고 공용 primitive와 제품 컴포넌트 경계를 유지함
