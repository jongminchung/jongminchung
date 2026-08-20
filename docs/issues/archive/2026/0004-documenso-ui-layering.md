# Issue 0004: Documenso 방식의 primitive와 제품 component 계층 정리

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `a9f5b6c`
- 우선순위: P2
- 기준일: 2026-08-19
- 참고 저장소: [documenso/documenso](https://github.com/documenso/documenso)
- 주요 참고 위치:
  [아키텍처 문서](https://github.com/documenso/documenso/blob/main/ARCHITECTURE.md),
  [packages/ui](https://github.com/documenso/documenso/tree/main/packages/ui),
  [app tests](https://github.com/documenso/documenso/tree/main/packages/app-tests)

## 핵심 요약

- **Documenso는 primitive, 일반 component와 문서 workflow component를 디렉터리 수준에서 구분함**
- **현재 저장소는 package와 앱의 소유권 경계는 더 엄격하지만 Git Client 앱 내부 component 분류는 혼재함**
- **공용 package를 확대하지 않고 Git Client의 제품 surface를 기능 단위로 정리하는 방식만 채택함**
- **Tailwind v3 config package와 숫자형 z-index 같은 구현은 현재 구조에 채택하지 않음**
- **대규모 파일 이동보다 변경 빈도가 높은 기능 한 개를 pilot으로 정리하는 것이 적절함**

## 참고 저장소에서 확인한 구조

- **`@documenso/ui`가 monorepo의 명시적인 core package로 정의됨**
  - primitive는 `packages/ui/primitives`에 위치함
  - 일반 composition은 `packages/ui/components`에 위치함
  - signing과 document flow 같은 제품 workflow도 하위 디렉터리로 구분됨
- **공유 Tailwind 설정과 UI source가 별도 package로 분리됨**
  - theme, animation, breakpoint와 제품 색상이 한 config에 모임
  - 여러 앱과 package가 같은 Tailwind v3 config를 소비함
- **Playwright가 별도 app-test package에서 제품 흐름을 검증함**
  - component package 검증보다 실제 document workflow를 중심으로 구성됨

## 현재 저장소와 비교

- **현재 공용 UI 소유권은 Documenso보다 명확함**
  - `packages/ui`에는 범용 primitive만 위치함
  - Git, terminal과 documentation domain component는 앱이 소유함
  - 제품 workflow를 공용 package에 넣지 않는 원칙을 유지함
- **Git Client 앱 내부에는 서로 다른 계층의 component가 같은 최상위 디렉터리에 있음**
  - `ProductDialog`, `ProductSelect` 같은 앱 공통 adapter가 있음
  - `HostingPanel`, `ChangesWorkspace`, `RepositoryInspectorDialog` 같은 기능 surface가 있음
  - `features/repository` 하위에도 같은 제품 영역의 composition이 있음
  - 기능을 수정할 때 관련 source와 test 위치를 탐색하는 비용이 발생할 수 있음
- **Tailwind 설정 package 분리는 현재 필요하지 않음**
  - Tailwind CSS v4의 CSS-first `@theme`와 `@source`를 이미 사용함
  - 공용 token과 앱 theme가 CSS 소유권으로 분리되어 있음

## 채택할 내용

- **Git Client 앱 내부 component를 세 계층으로 분류함**
  - 앱 공통 adapter: 제품 전체에서 사용하는 Dialog·Select·Menu·form control wrapper
  - 기능 composition: repository, changes, hosting, terminal 같은 도메인 조합
  - surface: route나 tool window에 가까운 상태 연결 component
- **기능 composition과 관련 test·style을 기능 디렉터리에 함께 둠**
  - 다른 기능에서 직접 소비하지 않는 helper와 hook을 colocate함
  - 공용 adapter가 기능 module을 import하지 않도록 단방향 의존성을 유지함
  - 제품 surface CSS는 현재 앱 전용 stylesheet와 component class 계약을 유지함
- **첫 pilot은 hosting 또는 repository inspector 중 한 영역으로 제한함**
  - 실제 변경이 필요한 영역을 선택함
  - public prop과 사용자 동작을 유지함
  - 이동 자체보다 import 방향과 책임 감소를 완료 기준으로 사용함

## 채택하지 않을 내용

- **제품 workflow component를 `packages/ui`로 이동하지 않음**
- **Tailwind config package를 새로 만들지 않음**
- **`primitives`, `components`라는 디렉터리 이름을 기계적으로 복제하지 않음**
- **모든 Git Client component를 한 PR에서 이동하지 않음**
- **파일 이동만 수행하고 책임과 import 방향을 그대로 두는 작업을 하지 않음**

## 실행 작업

- **현재 Git Client component inventory를 계층별로 분류함**
  - 앱 공통 adapter
  - repository 기능 composition
  - tool window와 surface
  - renderer·Electron 경계 component
- **한 개 pilot 영역의 target 구조를 정함**
  - entry component
  - state/controller hook
  - presentational section
  - 관련 style selector
  - unit·browser test
- **기존 소비 import를 단계적으로 갱신함**
  - root barrel을 만들지 않음
  - feature 간 역방향 import가 생기지 않도록 함
  - 이동과 동작 변경을 가능하면 별도 commit으로 분리함

## 완료 조건

- **pilot 영역의 entry point와 내부 구현 책임이 구분됨**
- **앱 공통 adapter가 기능 module을 import하지 않음**
- **제품 component가 `packages/ui`로 이동하지 않음**
- **기존 사용자 동작과 screenshot이 유지됨**
- **target 구조가 유효하지 않으면 추가 영역으로 확장하지 않고 결과를 기록함**

## 검증

- **Git Client의 가까운 검증부터 실행함**
  - `pnpm --filter @jongminchung/git-client run typecheck`
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run build`
  - 관련 Playwright test
  - 최종 `pnpm run check`
- **구조 변경 후 정적 검색으로 경계를 확인함**
  - 이전 path import 잔존 여부
  - 앱 공통 adapter의 feature import 여부
  - 새 root barrel과 순환 import 여부

## 2026-08-20 pilot 결과

- **hosting 영역이 이 문서의 pilot target 구조를 이미 충족해 추가 파일 이동 없이 완료함**
  - entry는 `components/HostingPanel.tsx`, controller는 `components/hosting/useHostingPanelController.ts`로 분리됨
  - account connection, request composer, list와 details section은 `components/hosting`에 colocate됨
  - controller unit test와 panel persistence test가 각각 상태 로직과 사용자 저장 동작을 검증함
- **앱 공통 adapter와 hosting 기능 사이의 의존 방향이 단방향으로 유지됨**
  - `ProductDialog`, `ProductSelect`, `ProductFormControls`, `ProductOverlays`가 hosting 또는 `features` module을 import하지 않음
  - hosting 기능은 공용 `@jongminchung/ui` primitive와 앱 adapter를 소비하며 `packages/ui`로 제품 의미를 이동하지 않음
- **추가 이동은 import 책임을 줄이지 않고 기존 `RepositoryToolDialog` entry만 흔들 수 있어 수행하지 않음**
  - 현재 구조가 유효하므로 repository inspector 등 두 번째 영역으로 범위를 확장하지 않음
