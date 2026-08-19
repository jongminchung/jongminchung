# Issue 0003: Formbricks 방식의 component 상태 fixture 도입

- 상태: 진행 중
- 우선순위: P1
- 기준일: 2026-08-19
- 참고 저장소: [formbricks/formbricks](https://github.com/formbricks/formbricks)
- 주요 참고 위치:
  [apps/web/modules/ui](https://github.com/formbricks/formbricks/tree/main/apps/web/modules/ui),
  [UI globals](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/ui/globals.css)

## 핵심 요약

- **Formbricks는 component source 옆에 상태별 story를 두어 복잡한 SaaS UI를 탐색 가능하게 관리함**
- **현재 저장소는 Playwright와 screenshot 기반이 강하지만 독립적인 상태 catalog는 없음**
- **Storybook을 새로 도입하지 않고 기존 QA fixture와 browser test를 상태 catalog로 확장하는 것이 적절함**
- **fixture는 이미 제품 흐름에서 검증되는 interaction을 중복하지 않고 시각·상태 조합의 공백만 담당해야 함**
- **첫 범위는 공용 primitive 전체가 아니라 회귀 비용이 높은 overlay·form·empty·loading 상태임**

## 진행 현황

- **Git Client 개발 서버에 deterministic component state surface를 추가함**
  - `?fixture=components`에서 Button variant·disabled·busy 상태를 함께 확인함
  - Field error·Checkbox selected·disabled·Empty·loading 상태를 실제 앱 theme 안에서 확인함
  - Dialog focus 복귀와 production primitive 사용을 Playwright로 검증함
- **fixture는 `import.meta.env.DEV` 분기에서 lazy-load함**
  - production navigation에서 활성화되지 않음
  - production renderer output에 fixture 문구가 포함되지 않는지 build 결과로 확인함
- **남은 범위는 light·dark screenshot과 Select·Menu open stacking surface임**

## 참고 저장소에서 확인한 구조

- **UI module이 primitive와 제품 component를 같은 탐색 경로에서 제공함**
  - Button·Dialog 같은 범용 component가 있음
  - survey editor와 analysis 같은 제품 component가 별도 module에 있음
  - 여러 component가 `stories.tsx`로 대표 상태를 함께 정의함
- **상태 token이 단일 색보다 역할 쌍으로 정의됨**
  - `success`, `warning`, `info`, `error`에 foreground와 background 역할을 둠
  - card shadow, breakpoint, animation도 이름을 가진 theme 항목으로 관리함
- **browser test를 광범위하게 사용함**
  - story는 탐색과 component 상태 표현을 담당함
  - Playwright는 실제 제품 흐름과 회귀를 담당함

## 현재 저장소와 비교

- **현재 저장소에는 별도 Storybook이나 story file이 없음**
  - 공용 UI는 server markup test로 주요 semantic을 검증함
  - Git Client는 QA fixture와 32개 Playwright test로 실제 workflow를 검증함
  - Web도 route 수준 Playwright 검증을 보유함
- **component 상태를 한 화면에서 비교하는 경로가 부족함**
  - loading, disabled, error, empty, selected와 destructive 조합을 찾으려면 여러 제품 흐름을 실행해야 함
  - theme나 spacing 변경이 여러 primitive에 미친 영향을 한 번에 검토하기 어려움
- **새 component explorer를 도입할 조건은 아직 충족되지 않음**
  - 독립 consumer와 외부 기여자 규모가 제한적임
  - 기존 Playwright fixture를 재사용할 수 있음

## 채택할 내용

- **기존 QA fixture에 개발·테스트 전용 component state surface를 추가함**
  - production navigation에는 노출하지 않음
  - deterministic data만 사용함
  - network, timer와 로컬 저장소 상태에 의존하지 않음
- **첫 상태 matrix는 회귀 가능성이 높은 조합으로 제한함**
  - Button의 variant·size·disabled·busy composition
  - Field의 label·description·error·required 상태
  - Empty와 loading 상태
  - Dialog·Select·Menu의 open 상태와 stacking
  - Tabs·Checkbox의 selected·mixed·disabled 상태
- **light·dark와 핵심 viewport에서 screenshot을 생성함**
  - snapshot은 상태 matrix의 의도된 전체 surface만 포함함
  - font, viewport와 fixture data를 고정함
  - 변경된 snapshot은 token·layout 변경과 함께 검토함

## 채택하지 않을 내용

- **Storybook과 별도 build pipeline을 추가하지 않음**
- **모든 component prop 조합을 조합 폭발 방식으로 나열하지 않음**
- **제품 workflow에서 이미 검증하는 keyboard test를 fixture에 그대로 중복하지 않음**
- **fixture를 공용 UI package의 runtime export로 제공하지 않음**

## 실행 작업

- **현재 테스트 coverage와 상태 matrix를 먼저 대조함**
  - server markup으로 충분한 상태
  - 기존 제품 Playwright에서 검증되는 interaction
  - 시각적으로만 확인 가능한 누락 상태
- **Git Client QA fixture에 첫 state surface를 구현함**
  - 기존 fixture 진입 방식과 같은 테스트 전용 switch 사용
  - 공용 primitive는 공개 subpath를 통해 실제 앱과 같은 방식으로 import함
  - 제품 CSS와 theme cascade를 실제 앱과 동일하게 적용함
- **필요성이 확인되면 Web용 state surface를 별도 추가함**
  - Server Component와 client boundary 조합이 필요한 상태만 포함함
  - Git Client fixture를 framework-neutral package로 추출하지 않음

## 완료 조건

- **대표 primitive 상태를 한 deterministic surface에서 확인할 수 있음**
- **light·dark screenshot이 의도한 상태 matrix를 포함함**
- **Dialog·Select·Menu의 stacking이 token 계약과 일치함**
- **fixture가 production route와 bundle entry에 노출되지 않음**
- **기존 제품 E2E와 중복되는 assertion이 추가되지 않음**
- **새 도구나 별도 workspace 없이 기존 Playwright 구성을 사용함**

## 검증

- **Git Client 첫 구현 기준 검증을 수행함**
  - `pnpm --filter @jongminchung/git-client run typecheck`
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run test:e2e`
  - `pnpm --filter @jongminchung/git-client run build`
- **공용 primitive source가 변경되면 UI 검증을 추가함**
  - `pnpm --filter @jongminchung/ui run typecheck`
  - `pnpm --filter @jongminchung/ui run test`
  - 최종 `pnpm run check`
