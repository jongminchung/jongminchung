# Issue 0030: React 19.2·Compiler 1.0·Cache Components 적용 검토

## 핵심 요약

- **현재 `react@19.2.8`과 `next@16.3.1`은 기능 사용 조건을 충족하지만 네 기능은 코드와 build 설정에서 활성화되지 않음**
- **가장 작은 즉시 과제는 Git Client의 반복 subscription을 `useEffectEvent` pilot으로 전환하고 listener 생명주기를 회귀 검증하는 작업임**
- **React Compiler 1.0은 두 앱 모두 annotation mode로 시작하되 수동 memoization 288회가 있는 Git Client에서 측정 가치가 더 큼**
- **Web의 Cache Components는 파일 기반 content를 정적 shell에 포함할 가치가 있으나 route segment config 19개와 async I/O 경계를 함께 migration해야 함**
- **Web navigation의 Activity는 Cache Components가 제공하므로 직접 boundary를 중복 추가하지 않음**
- **Git Client의 직접 Activity는 repository·terminal·watcher 상태 보존 요구와 resource 회귀가 증명될 때까지 조건부 보류함**

## 이슈 정보

- 상태: 실행 계획 확정
- 우선순위: P1
- 기준일: 2026-08-20
- 기준 commit: `b78c336`
- 영향 범위:
  [Web Next 설정](../../apps/web/next.config.ts),
  [Web content repository](../../apps/web/lib/content-repository.ts),
  [Git Client Vite 설정](../../apps/git-client/vite.config.ts),
  [workspace router](../../apps/git-client/src/app/AppWorkspaceRouter.tsx),
  [tool-window controller](../../apps/git-client/src/features/repository/tool-windows/useRepositoryToolWindowController.ts),
  [bottom-panel lifecycle](../../apps/git-client/src/components/bottom-panel/useBottomPanelLifecycle.ts),
  [Xterm surface](../../apps/git-client/src/components/XtermSurface.tsx)
- 공식 기준:
  [React 19.2](https://react.dev/blog/2025/10/01/react-19-2),
  [Activity](https://react.dev/reference/react/Activity),
  [useEffectEvent](https://react.dev/reference/react/useEffectEvent),
  [React Compiler 1.0](https://react.dev/blog/2025/10/07/react-compiler-1),
  [Compiler 설치](https://react.dev/learn/react-compiler/installation),
  [Compiler 점진 도입](https://react.dev/learn/react-compiler/incremental-adoption),
  [Next.js React Compiler](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler),
  [Next.js Cache Components](https://nextjs.org/docs/app/getting-started/cache-components),
  [Cache Components migration](https://nextjs.org/docs/app/guides/migrating-to-cache-components)

## 현재 저장소 기준선

- **두 앱은 React 19.2 API를 사용할 수 있는 버전 계약을 이미 가짐**
  - catalog가 `react@19.2.8`, `react-dom@19.2.8`, `@types/react@19.2.18`을 고정함
  - Web은 `next@16.3.1`, Git Client는 `vite@8.2.1`과 `@vitejs/plugin-react@6.0.5`를 사용함
- **Compiler lint와 Compiler transform은 서로 다른 상태임**
  - `oxlint.config.ts`의 `react/react-compiler: error`는 분석과 규칙 위반 검출만 수행함
  - `babel-plugin-react-compiler`는 lockfile의 optional peer 선언에만 나타나며 workspace dependency로 설치되지 않음
  - Web `next.config.ts`에 `reactCompiler`가 없고 Git Client Vite pipeline에도 compiler preset이 없음
- **새 API의 직접 사용은 아직 없음**
  - `<Activity>`와 `useEffectEvent` 사용 지점이 두 앱 모두 0개임
  - `useEffect`를 포함하는 파일은 Web 6개, Git Client 57개임
  - `useMemo`·`useCallback` 호출은 Web 13회, Git Client 288회임
- **Web cache 계약은 기존 static generation 모델을 사용함**
  - `cacheComponents`와 `use cache`가 없음
  - route segment의 `dynamic`·`dynamicParams` 선언이 19개이며 이 중 `force-static`이 8개임
  - `generateStaticParams`가 11개 route에 있고 content source는 filesystem async I/O와 `React.cache`를 사용함

## React 19.2 Activity 판단

- **Activity는 숨긴 subtree의 DOM과 React state를 보존하면서 Effect를 cleanup하는 API임**
  - `hidden` 상태는 DOM을 `display: none`으로 숨기고 Effect를 해제하며 update를 낮은 우선순위로 처리함
  - `visible` 복귀 시 이전 state를 복원하고 Effect를 다시 setup함
- **Web에는 직접 Activity를 추가하지 않음**
  - Cache Components 활성화 시 Next.js가 최근 client route를 Activity로 관리함
  - route sheet처럼 navigation identity가 바뀔 때 닫혀야 하는 상태는 Activity 보존 대상이 아님
  - 직접 boundary와 framework boundary를 중첩하면 보존 정책과 resource 비용의 소유자가 불명확해짐
- **Git Client의 repository workspace는 장기적으로 pilot 가치가 있음**
  - 현재 `AppWorkspaceRouter`는 active repository 한 개만 렌더링하고 repository id를 `key`로 사용해 workspace local state를 재생성함
  - 여러 repository를 전환할 때 editor selection·scroll·draft를 보존한다는 명시적 제품 요구가 생기면 Activity가 적합할 수 있음
- **현재 직접 도입은 resource lifecycle 위험 때문에 보류함**
  - `RepositoryWorkspace`가 watcher, persistence, CodeMirror, Xterm과 focus listener를 포함함
  - hidden 전환 시 Xterm dispose·재생성, repository watcher cleanup, focus restoration과 background update 우선순위를 함께 검증해야 함
  - 여러 hidden workspace DOM을 유지하는 memory 비용과 오래된 workspace 제거 정책이 없음

## React Compiler 1.0 판단

- **Compiler transform의 점진 도입을 후속 과제로 채택함**
  - Compiler 1.0은 build-time automatic memoization의 stable release임
  - 기존 memoization을 일괄 제거하면 Effect dependency identity가 달라질 수 있으므로 그대로 유지함
  - 기존 `0021`의 route sheet·theme·diagram 상태 회귀를 Compiler 동작 검증의 Web 기준선으로 재사용함
- **Git Client는 annotation mode의 leaf component pilot부터 수행함**
  - 수동 memoization 288회로 측정 가능한 후보가 많음
  - imperative editor·terminal·subscription hook은 첫 pilot에서 제외함
  - 순수 계산과 props 기반 render가 중심인 leaf component에 `"use memo"`를 적용함
  - Vite 8 경로는 `babel-plugin-react-compiler`, `@rolldown/plugin-babel`과 `reactCompilerPreset()` 연결이 필요함
- **Web도 annotation mode로 같은 compiler version을 검증함**
  - `next.config.ts`의 `reactCompiler: { compilationMode: "annotation" }` 경로를 사용함
  - compiler package는 exact version으로 catalog에 고정해 두 앱의 transform 차이를 줄임
  - `ThemeProvider`, Excalidraw와 route sheet는 interaction regression을 먼저 통과한 뒤 opt-in함
- **full compilation과 수동 memoization 제거를 초기 완료 조건으로 삼지 않음**
  - compile coverage보다 interaction 결과와 build 시간·bundle 변화가 우선함
  - compiler가 건너뛴 component는 실패로 간주하지 않고 pilot report에 남김
  - 의미 있는 render 또는 interaction 개선이 없으면 annotation 설정을 확대하지 않음

## React useEffectEvent 판단

- **Effect Event는 subscription identity와 최신 state 읽기를 분리하는 지점에만 도입함**
  - Effect Event는 최신 committed props와 state를 읽되 Effect dependency가 아님
  - 일반 event handler, child prop, dependency 누락 은폐 용도로 사용하지 않음
  - event를 구독하게 만드는 identity는 dependency에 유지하고 callback의 최신 값 읽기만 분리함
- **Git Client tool-window layout subscription을 첫 pilot으로 선택함**
  - 현재 layout 값 하나가 바뀔 때마다 capture·apply·process listener 세 개가 모두 해제되고 다시 등록됨
  - capture callback만 Effect Event로 분리하면 listener는 mount 동안 유지하면서 최신 layout snapshot을 반환할 수 있음
  - apply listener의 setter와 process listener는 안정성이 확인된 dependency만 유지함
- **bottom-panel workbench listener를 두 번째 후보로 선택함**
  - 여섯 subscription이 `collapsed`, panel action과 stash·shelf callback identity 변화에 따라 다시 등록될 수 있음
  - 각 listener callback을 Effect Event로 분리하면 event port 연결 생명주기와 최신 UI action을 독립시킬 수 있음
- **Xterm의 `onActionRef` 대체는 별도 후보로 유지함**
  - 현재 render 중 ref를 갱신해 terminal key handler가 최신 callback을 읽음
  - 같은 component의 terminal setup Effect 안에서 호출하는 Effect Event로 바꿀 수 있으나 terminal dispose 회귀 검증이 먼저 필요함
- **Web의 여섯 Effect 파일은 현재 일괄 migration하지 않음**
  - theme media query는 `mode` 변화가 실제 resynchronization 조건이므로 dependency를 제거하면 안 됨
  - Excalidraw scene identity와 search lifecycle도 최신 값 읽기와 재연결 조건을 먼저 구분해야 함

## Next.js 16 Cache Components 판단

- **Web에 build-only migration pilot을 수행함**
  - Cache Components는 static·cached·request-time content를 한 route에서 조합하며 PPR과 navigation Activity를 함께 활성화함
  - 현재 content는 repository 안의 MDX와 metadata가 source이므로 정적 shell에 포함할 명확한 대상이 있음
  - self-hosted standalone output에서도 지원되지만 runtime memory cache를 영속 저장소로 간주하면 안 됨
- **설정 활성화와 기존 route config 제거를 하나의 migration으로 다룸**
  - `dynamic = "force-static"`, `revalidate`, `fetchCache`는 `use cache`와 `cacheLife` 계약으로 대체됨
  - `dynamicParams`와 `generateStaticParams`의 404·미지정 path 동작을 route별로 다시 고정함
  - 설정만 켜고 기존 config를 남기는 중간 상태를 merge하지 않음
- **filesystem content I/O를 cache boundary 안에 명시함**
  - `readContentSnapshot`, `renderTechMdx`, `renderInvestmentMdx`의 async I/O를 build마다 다시 읽을 source와 runtime cache 대상으로 구분함
  - `React.cache`는 request deduplication이며 `use cache`의 persistent semantic을 대신하지 않음을 문서화함
  - cached 함수의 locale·document id를 serializable key로 유지함
- **현재 정적 출력 계약을 먼저 보존함**
  - 문서·투자 note·RSS·robots·OG route의 build output과 404 matrix가 기존 결과와 같아야 함
  - `/tech/[locale]/[[...slug]]`의 알려지지 않은 slug 동작과 metadata 생성을 별도로 검증함
  - client navigation에서 search·sheet·theme·diagram state가 의도치 않게 보존되거나 초기화되지 않는지 확인함

## 실행 순서

- **1단계는 `useEffectEvent`의 Git Client subscription pilot임**
  - tool-window capture listener의 등록 횟수와 최신 layout snapshot test를 먼저 추가함
  - bottom-panel event listener는 callback 변경 중 단일 subscription과 최신 action 실행을 검증함
  - Xterm은 terminal lifecycle test가 준비된 뒤 별도 commit으로 전환함
- **2단계는 React Compiler annotation pilot임**
  - compiler와 Vite Babel bridge를 exact catalog dependency로 추가함
  - 두 앱에서 순수 leaf component 2~3개만 opt-in함
  - dev·build 시간, bundle report와 interaction test 결과를 compiler 비활성 기준선과 비교함
- **3단계는 Web Cache Components migration branch임**
  - route config inventory와 expected build output을 test fixture로 먼저 고정함
  - content repository의 cache boundary를 정한 뒤 `cacheComponents: true`를 활성화함
  - 모든 route migration과 production build가 끝난 상태만 merge함
- **4단계는 Activity 도입 조건 재평가임**
  - Web은 Cache Components navigation 결과만 검증함
  - Git Client는 multi-repository back-state 제품 요구와 memory budget이 생길 때만 direct pilot을 시작함

## 완료 조건

- **Effect Event pilot에서 state 변경이 listener 재등록을 만들지 않고 event가 최신 state를 관찰함**
- **Compiler pilot에서 두 앱의 opt-in component가 실제 compile되고 기존 interaction 계약이 유지됨**
- **Compiler 전후 build 시간·bundle 크기·대표 interaction 결과가 같은 형식으로 기록됨**
- **Cache Components build에서 모든 공개 route·metadata·RSS·robots·OG·404 계약이 유지됨**
- **Cache Components navigation에서 framework Activity가 보존하는 상태와 route identity가 초기화하는 상태를 test로 구분함**
- **Git Client direct Activity는 resource·memory 완료 조건이 생기기 전까지 코드에 추가되지 않음**

## 검증

- **Git Client의 가까운 검사부터 실행함**
  - `pnpm --filter @jongminchung/git-client run typecheck`
  - `pnpm --filter @jongminchung/git-client run test`
  - subscription·terminal 관련 Playwright와 Electron package test를 변경 범위에 맞게 실행함
- **Web의 cache와 compiler 계약을 production build로 검증함**
  - `pnpm --filter @jongminchung/web run typecheck`
  - `pnpm --filter @jongminchung/web run test`
  - `pnpm --filter @jongminchung/web run build`
  - `pnpm --filter @jongminchung/web run test:e2e`
- **workspace 연결 변경 후 전체 계약을 검증함**
  - `pnpm run check`
  - `git diff --check`
  - `git status --short`
