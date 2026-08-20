# Issue 0021: React compiler lint 대응의 상태 계약 회귀 보강

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `7f4a72b`
- 우선순위: P1
- 기준일: 2026-08-19
- 기준 commit: `f8ece16`
- 영향 범위:
  [Oxlint 설정](../../../../oxlint.config.ts),
  [route sheet hook](<../../../../apps/web/app/(tech)/_components/useRouteSheet.ts>),
  [ThemeProvider](../../../../apps/web/components/ThemeProvider.tsx),
  [ExcalidrawDiagram](<../../../../apps/web/app/(tech)/_components/ExcalidrawDiagram.tsx>),
  [ExcalidrawCanvas](<../../../../apps/web/app/(tech)/_components/ExcalidrawCanvas.tsx>)
- 참고 OSS:
  [Oxlint react/react-compiler](https://oxc.rs/docs/guide/usage/linter/rules/react/react-compiler.html),
  [React You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect),
  [React hooks lint](https://react.dev/reference/eslint-plugin-react-hooks)

## 핵심 요약

- **`react/react-compiler` 도입 방향은 타당하지만 lint 통과를 위해 effect의 state update를 우회한 일부 변경이 사용자 상태 계약을 바꿈**
- **`useRouteSheet`는 A 경로에서 연 sheet를 B 경로로 이동해 닫은 뒤 browser back으로 A에 돌아오면 다시 여는 확정적 회귀가 있음**
- **`ThemeProvider`의 `requestAnimationFrame` state update는 DOM theme와 control state를 한 frame 분리하고 이전 초기값이 뒤늦게 적용될 여지를 만듦**
- **Excalidraw readiness는 scene identity를 갱신하지만 실제 canvas를 새 scene으로 remount하거나 update하지 않아 stale scene을 ready로 보고할 수 있음**
- **실험적 compiler lint를 끄기보다 React의 key·external store·명시적 renderer update 패턴으로 상태 소유권을 다시 설계해야 함**

## OSS 기준에서 확인한 원칙

- **Oxlint의 `react/react-compiler`는 React Compiler 분석을 lint-only로 실행하는 experimental rule임**
  - rule 통과가 React Compiler transform 활성화를 의미하지 않음
  - compiler가 거부한 구조를 timer나 frame callback으로 감추는 것이 완료 조건이 될 수 없음
- **React는 identity가 바뀔 때 전체 local state를 초기화하려면 `key`를 사용하는 방식을 권장함**
  - route, locale 또는 scene이 component identity라면 state owner 경계에 key를 둠
  - 이전 identity의 state를 문자열 비교로 숨긴 채 보존하지 않음
- **외부 browser 상태는 subscription과 snapshot으로 모델링할 수 있음**
  - document language는 이번 commit에서 `useSyncExternalStore`로 올바르게 전환됨
  - local storage와 system theme도 같은 원칙으로 별도 store 계약을 만들 수 있음

## 현재 저장소에서 확인한 회귀와 위험

- **route sheet는 닫힌 상태가 아니라 마지막으로 열었던 pathname을 저장함**
  - A에서 열기: `openedPathname = A`, `isOpen = true`
  - B로 이동: `openedPathname = A`, `isOpen = false`
  - browser back으로 A 복귀: 값이 그대로이므로 `isOpen = true`
  - 이전 effect 구현은 최초 route 변경 시 state를 `false`로 확정했음
- **theme 초기화는 state 적용을 다음 animation frame으로 미룸**
  - DOM의 `data-theme`는 effect에서 즉시 바뀜
  - context의 `mode`는 최소 한 frame 동안 `system`을 유지함
  - frame 전에 다른 update가 생기면 예약된 초기값이 더 최신 state 뒤에 실행될 수 있음
- **Excalidraw는 readiness identity와 실제 renderer identity가 분리됨**
  - parent의 `onReady` callback은 scene identity마다 새로 생성됨
  - child effect는 새 callback으로 다시 실행되지만 `initialData`는 이미 mount된 Excalidraw의 초기 입력임
  - scene 교체 시 실제 element가 갱신되지 않아도 새 scene의 identity로 element count를 보고할 수 있음
- **현재 콘텐츠는 standalone scene 한 개와 inline scene 0개라 scene 교체 회귀가 아직 제품 경로에서 드러나지 않음**
  - component 공개 계약은 `source`와 `src` 변경을 허용함
  - 두 번째 diagram 또는 client navigation이 추가되기 전에 회귀 test가 필요함

## 채택할 내용

- **route sheet state owner를 route identity로 재생성함**
  - pathname 또는 안정된 current route key를 state owner의 `key`로 사용함
  - route 이동과 browser history 복귀 모두 닫힌 상태로 시작함
  - focus restoration은 사용자가 명시적으로 닫은 경우와 route unmount를 구분함
- **theme를 timer 없이 일관된 snapshot으로 제공함**
  - local storage mode와 system preference를 하나의 external store 또는 bootstrap snapshot으로 모델링함
  - DOM theme와 context mode가 같은 commit에서 관찰되도록 함
  - storage event를 지원할지 여부를 명시적으로 결정함
- **Excalidraw renderer를 scene identity와 함께 갱신함**
  - `<Canvas key={sceneIdentity}>`로 remount하거나 Excalidraw API의 명시적 scene update를 사용함
  - readiness는 실제 API가 반환한 element와 expected scene identity를 함께 확인함
  - 두 scene 간 전환 test를 추가함
- **compiler lint를 유지하고 회귀 test를 먼저 추가함**
  - timer·RAF·숨겨진 stale state로 lint만 우회하는 변경을 금지함
  - 사용자에게 보이는 상태 전이를 완료 조건으로 둠

## 채택하지 않을 내용

- **`react/react-compiler` rule 전체를 단순 비활성화하지 않음**
- **lint를 통과하기 위해 synchronous state update를 `setTimeout`이나 `requestAnimationFrame`으로 옮기지 않음**
- **route 변경 뒤 state를 보이지 않게만 만들고 이전 route state를 계속 보존하지 않음**
- **Excalidraw element count 일치만으로 scene content 갱신을 증명하지 않음**

## 완료 조건

- **A에서 sheet를 연 뒤 B로 이동하고 A로 돌아와도 sheet가 닫혀 있음**
- **stored theme와 system theme에서 첫 안정 frame의 DOM·control state가 일치함**
- **두 Excalidraw scene 전환 시 실제 text·element와 readiness identity가 함께 바뀜**
- **`react/react-compiler`와 `react/rules-of-hooks`가 error 상태로 통과함**
- **변경된 상태 전이가 unit 또는 Playwright test로 고정됨**

## 검증

- **Web의 가까운 검증부터 실행함**
  - `pnpm --filter @jongminchung/web run typecheck`
  - `pnpm --filter @jongminchung/web run test`
  - `pnpm --filter @jongminchung/web run build`
  - route sheet·theme·diagram 관련 Playwright test
- **browser history, stored mode, system mode와 두 scene 전환을 각각 검증함**
- **최종 `pnpm run check`, `git diff --check`, `git status --short`를 실행함**

## 구현 결과

- **route sheet와 theme 상태 계약을 완료함**
  - sheet state를 boolean으로 단순화하고 route identity에서 owner를 재생성함
  - browser back으로 돌아와도 닫힌 상태임을 E2E로 검증함
  - theme를 `useSyncExternalStore` snapshot으로 전환해 animation frame 지연을 제거함
- **Excalidraw renderer identity와 전용 fixture를 완료함**
  - scene identity가 바뀌면 canvas를 remount하도록 연결함
  - 같은 element 수이지만 text가 다른 두 scene을 Playwright fixture에서 전환함
  - 실제 renderer API의 element 수와 text content가 새 scene과 일치해야 `ready`가 되도록 함
  - fixture route는 `PLAYWRIGHT_TEST=1`에서만 제공하고 일반 production 실행에서는 404를 유지함
