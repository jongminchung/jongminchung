# Issue 0009: 접근성 환경 matrix 검증 보강

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `7f4a72b`
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [공용 globals](../../../../packages/ui/src/styles/globals.css),
  [Git Client Playwright](../../../../apps/git-client/playwright.config.ts),
  [Web Playwright](../../../../apps/web/playwright.config.ts)

## 핵심 요약

- **현재 접근성 검증은 semantic·keyboard·focus·axe와 light·dark theme를 중심으로 구성됨**
- **공용 CSS에는 reduced motion 처리가 있지만 browser test에서 실제 적용을 증명하지 않음**
- **forced colors, contrast preference, reflow와 확대 환경의 회귀 검증이 부족함**
- **모든 component 조합보다 대표 surface와 실패 비용이 높은 interaction을 선정해야 함**
- **자동화가 브라우저 실제 동작을 충분히 재현하지 못하는 항목만 최소 manual checklist로 남김**

## 현재 문제와 근거

- **reduced motion provider는 전역으로 존재함**
  - animation과 transition duration을 축소함
  - 실제 overlay가 이 설정에서 불필요한 motion 없이 열리고 닫히는지 확인하지 않음
- **Git Client는 제품 zoom을 지원함**
  - 100%, 125%, 150% 설정이 있음
  - 최소 viewport test는 있지만 zoom과 tool window·dialog 조합의 reflow 검증은 제한적임
- **forced colors와 contrast 환경에 대한 명시적 처리가 없음**
  - border만으로 구분되는 selected·disabled 상태가 사라질 가능성이 있음
  - focus ring과 destructive 상태가 시스템 색상에서 유지되는지 근거가 없음

## 채택할 내용

- **대표 환경 matrix를 Playwright project 또는 focused test로 구성함**
  - `reducedMotion: "reduce"`
  - `forcedColors: "active"`
  - contrast preference 지원 범위
  - light·dark
  - 최소 viewport와 Git Client 150% product zoom
- **대표 surface를 제한함**
  - Dialog·Select·Menu의 focus와 dismissal
  - Field error와 disabled control
  - Changes workspace와 tool window
  - Web navigation·search·document content
  - loading·empty·destructive 상태
- **assertion은 환경별 핵심 실패를 직접 확인함**
  - focus indicator가 보이고 clipping되지 않음
  - selected·disabled·error가 색상만으로 구분되지 않음
  - reduced motion에서 긴 animation을 기다리지 않음
  - 확대와 좁은 viewport에서 핵심 action에 접근 가능함

## 채택하지 않을 내용

- **모든 테스트를 모든 환경 조합으로 반복하지 않음**
- **axe 결과만으로 forced colors와 reflow를 통과한 것으로 판단하지 않음**
- **screenshot pixel 차이만으로 focus와 semantic을 검증하지 않음**
- **브라우저 zoom과 CSS transform을 동일한 것으로 취급하지 않음**
- **지원 근거 없이 접근성 전용 JavaScript polyfill을 추가하지 않음**

## 실행 작업

- **현재 browser test를 환경별 coverage matrix로 분류함**
- **Git Client에 reduced motion·forced colors·150% zoom 대표 test를 추가함**
- **Web에 forced colors와 narrow viewport reflow test를 추가함**
- **자동화가 어려운 실제 브라우저 200% zoom은 최소 수동 검증 대상으로 분리함**
- **발견된 문제는 primitive와 제품 composition 소유권에 따라 별도 수정함**

## 완료 조건

- **대표 overlay가 reduced motion 환경에서 keyboard·focus 동작을 유지함**
- **forced colors에서 focus·selected·disabled·error 상태를 구분할 수 있음**
- **Git Client 150% zoom과 최소 viewport에서 핵심 action이 clipping되지 않음**
- **Web의 navigation과 document content가 좁은 viewport에서 양방향 scroll 없이 reflow됨**
- **환경 matrix가 기존 전체 E2E 시간을 과도하게 중복시키지 않음**

## 검증

- **공용 source 변경 시 UI package 검증을 수행함**
  - `pnpm --filter @jongminchung/ui run typecheck`
  - `pnpm --filter @jongminchung/ui run test`
- **앱별 focused browser test와 production build를 수행함**
  - `pnpm --filter @jongminchung/web run test:e2e`
  - `pnpm --filter @jongminchung/git-client run test:e2e`
  - 영향받는 앱 build
  - 최종 `pnpm run check`

## 구현 결과

- **Web의 대표 환경 검증은 완료됨**
  - 390px viewport에 forced colors와 reduced motion을 함께 적용함
  - 모바일 문서 탐색의 focus 복귀와 긴 transition 제거를 검증함
  - 테스트가 발견한 문서 content의 수평 overflow를 `overflow-wrap`으로 해소함
- **Git Client의 대표 환경 검증을 완료함**
  - 960×640 viewport에서 reduced motion·forced colors·150% product zoom을 함께 적용함
  - Settings dialog의 keyboard focus·checked semantic·viewport clipping·motion duration을 검증함
  - forced colors와 reduced motion media query가 실제 활성화된 browser context에서 실행됨을 확인함
- **실제 브라우저 200% zoom은 release UI 점검의 수동 항목으로 유지함**
  - main toolbar의 repository·settings action 접근 가능 여부를 확인함
  - Settings dialog의 닫기 action과 100% zoom 복귀 가능 여부를 확인함
  - 수평·수직 양방향 scroll 없이 현재 focus를 식별할 수 있는지 확인함
