# Issue 0002: shadcn upstream 차이와 스타일 사용 방식 점검

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `a9f5b6c`
- 우선순위: P1
- 기준일: 2026-08-19
- 참고 저장소: [shadcn-ui/ui](https://github.com/shadcn-ui/ui)
- 주요 참고 위치:
  [스타일 규칙](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/rules/styling.md),
  [theme customization](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/customization.md),
  [monorepo 가이드](https://ui.shadcn.com/docs/monorepo)

## 핵심 요약

- **공식 shadcn source는 component 초안뿐 아니라 semantic token과 consumer override 원칙의 기준임**
- **현재 저장소는 semantic token, `cn()`, explicit subpath와 앱별 composition 경계를 이미 충족함**
- **남은 공백은 28개 공용 primitive의 upstream 차이와 로컬 보정 이유를 일관되게 확인하는 과정임**
- **이번 이슈는 공용 UI 공개 API나 export map을 바꾸지 않고 source와 consumer 사용 방식을 점검함**
- **upstream과 다르다는 사실 자체를 오류로 보지 않고 접근성·API·제품 요구별로 차이를 분류함**

## 참고 저장소에서 확인한 원칙

- **색상은 raw palette보다 semantic token을 우선함**
    - 상태 색상이 없으면 token이나 semantic variant를 먼저 정의함
    - component consumer가 `dark:` 색상으로 theme를 직접 다시 구현하지 않음
- **component appearance 변경은 정해진 우선순위를 따름**
    - built-in variant 사용
    - semantic token 사용
    - CSS variable 추가
    - 정책을 추가하는 wrapper 또는 composition 사용
- **`className`은 component 내부 시각 계약을 덮기보다 layout 조정에 사용함**
    - 조건부 class는 완전한 문자열과 `cn()`으로 구성함
    - 동일한 크기의 width와 height는 `size-*`, sibling spacing은 `gap-*`을 우선함
- **overlay의 stacking은 primitive 또는 제품 overlay wrapper가 소유함**
    - Dialog·Menu·Popover consumer마다 임의의 숫자 `z-index`를 추가하지 않음

## 현재 저장소와 비교

- **현재 theme와 Tailwind 구조는 공식 v4 방향과 일치함**
    - provider 값과 `@theme inline` adapter가 분리됨
    - palette utility 대신 semantic utility를 사용함
    - 앱은 공용 globals 뒤에서 제품 token만 override함
- **공용 primitive 검증은 전체 surface를 동일한 깊이로 다루지 않음**
    - `packages/ui/src/components`에는 28개 primitive가 있음
    - server markup test는 대표 semantic을 검증하지만 모든 interactive primitive의 upstream 차이를 설명하지 않음
    - interaction은 앱 Playwright에 분산되어 있어 component별 근거를 찾는 비용이 있음

## 채택할 내용

- **primitive별 upstream 차이 audit를 수행함**
    - 대상 component의 공식 registry source를 `--diff`로 확인함
    - 차이를 접근성 보정, 공개 API 유지, theme 적응, 제품 비종속 variant, 불필요한 drift로 분류함
    - 삭제 조건이 있는 임시 upstream 보정은 관련 version이나 upstream PR을 연결함
- **consumer override를 공식 우선순위에 맞춰 정리함**
    - 기존 variant로 표현 가능한 색상·상태 override를 확인함
    - 제품 layout class는 호출 위치에 유지함
    - 반복되는 제품 구조 selector는 앱 CSS 또는 앱 component가 소유함
- **점검 결과가 실제 변경을 요구할 때만 source를 수정함**
    - 단순 formatting이나 최신 upstream과의 기계적 일치를 목표로 하지 않음
    - 공개 prop, export와 소비 import 변경은 이 이슈에서 수행하지 않음

## 채택하지 않을 내용

- **공식 registry source를 `--overwrite`로 일괄 반영하지 않음**
- **공용 UI API를 upstream API와 완전히 동일하게 만들지 않음**
- **스타일 규칙을 새 lint plugin이나 architecture contract test로 자동화하지 않음**
- **앱의 제품 layout을 primitive variant로 이동하지 않음**

## 실행 작업

- **1단계로 interaction과 overlay를 가진 component부터 점검함**
    - Dialog
    - Select
    - Dropdown Menu
    - Popover
    - Command
    - Tabs
    - Checkbox
- **2단계로 form과 display primitive를 점검함**
    - Button·Button Group
    - Field·Input·Textarea·Label
    - Alert·Badge·Card·Empty·Item
    - Table·Scroll Area·Toggle 계열·Tooltip·Spinner
- **각 component에 대해 다음 결과를 PR 설명에 기록함**
    - upstream 기준 source와 version
    - 유지할 local delta와 이유
    - 제거한 drift
    - 영향을 받는 consumer와 실행한 검증

## 완료 조건

- **28개 primitive가 검토 대상 목록에서 누락되지 않음**
- **임시 보정은 upstream 연결과 제거 조건을 가짐**
- **공개 API·export 변경 없이 불필요한 style drift가 제거됨**
- **변경된 interaction은 role·keyboard·focus assertion으로 검증됨**
- **시각 변경이 있으면 영향받는 앱 screenshot을 직접 검토함**

## 검증

- **공용 package의 정적·markup 계약을 확인함**
    - `pnpm --filter @jongminchung/ui run typecheck`
    - `pnpm --filter @jongminchung/ui run test`
    - `pnpm --filter @jongminchung/ui run build`
- **영향받는 consumer를 확인함**
    - Web 변경 시 `pnpm --filter @jongminchung/web run build`
    - interaction 변경 시 해당 앱 Playwright test
    - 최종 `pnpm run check`

## 2026-08-20 audit 결과

- **catalog의 `shadcn` 4.17.0과 현재 registry 계열 source 계약을 기준으로 28개 primitive를 모두 점검함**
    - interaction·overlay 8개는 `checkbox`, `command`, `dialog`, `dropdown-menu`, `popover`, `select`, `tabs`, `tooltip`임
    - form·control 10개는 `button`, `button-group`, `field`, `input`, `input-group`, `label`, `radio-group`, `textarea`, `toggle`, `toggle-group`임
    - display·layout 10개는 `alert`, `badge`, `card`, `empty`, `item`, `scroll-area`, `separator`, `sheet`, `spinner`, `table`임
- **공개 API를 변경하거나 제거해야 할 불필요한 drift가 확인되지 않음**
    - `@base-ui/react`의 `data-open`, `data-closed`, portal·positioner 구조는 현재 runtime에 필요한 theme 적응으로 분류됨
    - semantic token, `cn()`, `size-*`, `gap-*` 사용은 저장소 스타일 계약과 일치함
    - Dialog·Select·Menu의 숫자형 app override는 제품 layer token과 fixture 검증으로 이미 대체됨
- **primitive 내부의 `z-50`과 `dark:` 상태 class는 공용 overlay stacking과 semantic token 상태 표현으로 유지함**
    - 앱 consumer가 별도 palette나 임의 숫자로 theme·stacking을 다시 구현하는 사례와 구분됨
- **임시 upstream patch 또는 제거 version이 필요한 보정이 확인되지 않아 upstream PR 연결 항목이 없음**
- **기계적 overwrite와 공개 export 변경을 수행하지 않아 source diff 없이 audit를 완료함**
