# Issue 0008: 프론트엔드 JavaScript와 CSS 성능 예산 도입

- 상태: 제안
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [Git Client package](../../apps/git-client/package.json),
  [Web package](../../apps/web/package.json),
  [Git Client styles](../../apps/git-client/src/styles),
  [Web app](../../apps/web/app)

## 핵심 요약

- **현재 production build는 asset 크기를 출력하지만 허용 가능한 증가 폭과 소유자가 정의되지 않음**
- **2026-08-19 Git Client build에서 main JavaScript는 약 874KB, 전체 진입 CSS는 약 225KB로 보고됨**
- **bundle 경고를 단순히 숨기기보다 optional feature와 공통 entry의 경계를 확인해야 함**
- **첫 단계는 실패 gate가 아니라 재현 가능한 측정과 PR diff 보고이며 이후 검증된 기준만 ratchet해야 함**
- **성능 예산 script는 각 workspace가 소유하고 루트에는 저장소 전체 orchestration만 허용함**

## 현재 문제와 근거

- **Git Client build가 bundler의 500KB chunk 경고를 출력함**
  - main renderer entry가 경고 기준을 초과함
  - CodeMirror, xterm과 여러 dialog가 lazy chunk를 만들지만 main entry도 큼
- **CSS source의 성장 위치가 분산됨**
  - Git Client의 `product-surfaces.css`가 여러 제품 surface를 포함함
  - Web의 Home·Investment·Documentation CSS Module이 각각 독립적으로 성장함
  - source line 수 자체보다 최종 중복 rule과 사용되지 않는 output을 확인할 수단이 부족함
- **현재 크기 변화는 build log를 수동 비교해야 함**
  - PR별 baseline과 diff가 남지 않음
  - dependency update가 bundle에 미친 영향을 분리하기 어려움

## 채택할 내용

- **두 앱의 production asset manifest를 machine-readable하게 수집함**
  - entry JavaScript raw·gzip 크기
  - lazy chunk raw·gzip 크기
  - 전체 JavaScript와 CSS 합계
  - route 또는 feature와 chunk의 연결 정보
- **첫 PR에서 안정적인 baseline을 확정함**
  - clean install과 production build를 반복해 변동 여부를 확인함
  - hash가 아니라 논리 entry와 asset 유형을 기준으로 비교함
  - source map과 font·image는 JavaScript·CSS와 별도 분류함
- **baseline 이후 증가 예산을 적용함**
  - 작은 증가는 PR report에 표시함
  - 기준을 넘는 증가는 원인과 승인된 예외를 요구함
  - 개선된 크기는 새 baseline으로 낮추는 ratchet 방식을 사용함
- **예산 초과 원인을 feature ownership으로 연결함**
  - eager import된 optional dialog
  - 중복 dependency
  - editor·terminal·chart renderer
  - 중복 또는 전역 CSS rule

## 채택하지 않을 내용

- **현재 bundler 경고를 `chunkSizeWarningLimit` 증가만으로 숨기지 않음**
- **모든 lazy chunk를 임의로 합치거나 쪼개지 않음**
- **초기 측정 한 번으로 공격적인 고정 threshold를 설정하지 않음**
- **font·image와 JavaScript를 같은 숫자로 합산하지 않음**
- **workspace 한 곳만 실행하는 루트 전달 script를 추가하지 않음**

## 실행 작업

- **Git Client에 production asset report를 생성하는 workspace script를 추가함**
- **Web의 주요 Host·route별 client asset을 동일한 형식으로 수집함**
- **CI가 baseline 대비 diff를 요약하도록 함**
- **첫 최적화 후보를 bundle graph로 확인함**
  - main entry에 포함된 optional surface
  - 중복 package instance
  - 큰 editor·terminal dependency의 loading boundary
- **최적화는 측정 결과가 확인된 항목만 별도 PR로 수행함**

## 완료 조건

- **clean production build에서 재현 가능한 JSON 또는 표준 report가 생성됨**
- **PR에서 entry·lazy chunk·CSS의 증가와 감소를 확인할 수 있음**
- **예산 초과 시 영향 package와 주요 원인이 출력됨**
- **baseline 변경은 이유와 전후 수치를 포함함**
- **bundle 측정이 앱 runtime 동작이나 source map 배포를 변경하지 않음**

## 검증

- **각 workspace의 production build를 기준으로 측정함**
  - `pnpm --filter @jongminchung/web run build`
  - `pnpm --filter @jongminchung/git-client run build`
- **loading boundary 변경 시 관련 browser test를 실행함**
  - `pnpm --filter @jongminchung/web run test:e2e`
  - `pnpm --filter @jongminchung/git-client run test:e2e`
  - 최종 `pnpm run check`
