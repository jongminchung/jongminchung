# Issue 0037: Web 초기 폰트 전송량과 예산 정리

- 상태: 구현 완료·visual baseline 검토 대기
- 우선순위: P2
- 기준일: 2026-08-20
- 영향 범위:
  [font registration](../../apps/web/app/fonts.ts),
  [font asset manifest](../../apps/web/font-assets.json),
  [Pretendard dynamic subset CSS](../../apps/web/public/fonts/pretendard-variable/dynamic-subset.css),
  [Pretendard Std source](../../apps/web/app/fonts/PretendardStdVariable.woff2),
  [root layout](../../apps/web/app/root-layout.tsx),
  [shared typography tokens](../../packages/ui/src/styles/theme.css),
  [initial transfer test](../../apps/web/app/initial-transfer.e2e.test.ts),
  [initial transfer budget](../../apps/web/initial-transfer-budget.json)

## 핵심 요약

- **Home·Tech·Invest의 한국어와 영어 HTML이 모두 `2,057,688 bytes` Pretendard variable font를 선로드함**
- **WOFF2 단일 파일이라 영어 경로도 한국어 glyph를 포함한 전체 전송 비용을 지불함**
- **정적 JavaScript와 CSS 산출물 합계만으로는 초기 렌더링의 가장 큰 단일 asset이 예산에서 제외됨**
- **locale별 glyph 요구와 typography 회귀를 유지하면서 subset·unicode-range·system fallback 대안을 비교해야 함**
- **폰트는 JavaScript·CSS와 합산하지 않고 route 초기 전송량의 독립 예산으로 관리해야 함**

## 현재 문제와 근거

- **모든 site와 locale이 같은 font registration을 사용함**
  - `fonts.ts`가 `PretendardVariable.woff2` 한 파일을 `next/font/local`로 등록함
  - Home·Tech·Invest layout이 모두 같은 `pretendard.variable` class를 `<html>`에 적용함
  - 영어와 한국어 route의 실제 glyph 범위 차이가 loading 정책에 반영되지 않음
- **production HTML이 큰 font를 요청 우선순위에 올림**
  - 로컬 production build의 `jamie.localhost/en`, `tech.jamie.localhost/en`, `invest.jamie.localhost/en` 응답이 같은 WOFF2를 `Link: rel=preload`로 제공함
  - font 응답의 `Content-Length`는 `2,057,688`이며 이미 WOFF2이므로 HTTP 압축으로 추가 감소하지 않음
  - HTML 크기보다 큰 공통 font가 방문 route와 무관하게 초기 요청에 포함됨
- **정적 산출물 집계가 font 회귀를 관찰하지 못함**
  - JavaScript·CSS 파일 합계는 실제 route에서 요청한 font를 포함하지 않음
  - 전체 빌드 산출물 크기는 브라우저의 초기 전송량을 나타내지 않음
  - 완료된 Issue `0008`도 font와 image를 JavaScript·CSS와 별도 분류하도록 결정했지만 별도 budget은 구현하지 않음

## 채택할 내용

- **동일한 route와 visual fixture로 font loading 대안을 비교함**
  - 영어 전용 Latin subset과 system fallback
  - 한국어·영어 unicode-range 분할
  - route locale별 preload 또는 preload 비활성화
  - variable font 축과 실제 사용 weight를 기준으로 한 subset
- **폰트 품질과 전송 비용을 함께 평가함**
  - 한국어 조합형·영문·숫자·기술 기호 glyph coverage
  - Home·Tech·Invest의 wide·mobile visual snapshot
  - font swap 시 layout shift와 fallback metric
  - cold-cache 초기 font request 수와 전송 byte
- **Web route 단위 font budget을 별도로 기록함**
  - Home·Tech·Invest 대표 영어·한국어 route를 측정함
  - raw source 파일 합계가 아니라 브라우저가 초기 렌더링에서 요청한 font를 측정함
  - JavaScript·CSS와 구분된 threshold와 변경 사유를 유지함

## 채택하지 않을 내용

- **폰트 비용을 기존 JavaScript·CSS 합계에 더해 원인과 개선 수단을 섞지 않음**
- **한국어 glyph coverage 확인 없이 ASCII subset으로 교체하지 않음**
- **외부 CDN을 추가해 self-hosting·privacy·cache ownership을 약화하지 않음**
- **preload만 제거하고 실제 다운로드 크기를 개선한 것으로 간주하지 않음**
- **Excalidraw의 on-demand font 13MB와 일반 page의 초기 Pretendard 전송을 같은 budget으로 합치지 않음**

## 실행 작업

- **대표 route의 cold-cache font request와 byte baseline을 자동 측정함**
- **Latin·Korean glyph coverage를 보존하는 최소 두 가지 loading 대안을 실험함**
- **선택한 subset 또는 locale-aware loading 계약을 font registration과 layout에 적용함**
- **영어 route가 불필요한 전체 Korean font를 선로드하지 않도록 함**
- **visual·accessibility·layout shift fixture로 typography 회귀를 확인함**
- **별도 font budget과 intentional baseline 갱신 절차를 문서화함**

## 완료 조건

- **대표 영어 route의 초기 font 전송량이 현재 `2,057,688 bytes`보다 유의미하게 감소함**
- **한국어와 영어의 필수 glyph·weight·font-display 동작이 유지됨**
- **Home·Tech·Invest visual snapshot과 접근성 검사가 유지됨**
- **font 증가가 route별 JavaScript·CSS 예산과 구분되어 PR에서 확인 가능함**
- **font baseline 변경에 전후 byte와 선택 이유가 기록됨**

## 검증

- `pnpm --filter @jongminchung/web run build`
- `pnpm --filter @jongminchung/web exec playwright test app/initial-transfer.e2e.test.ts --project tech-chromium`
- `pnpm --filter @jongminchung/web run test:e2e`
- `pnpm run check`
- `git diff --check`

## 처리 결과

- **제품 typography 일관성을 위해 영어와 한국어 route 모두 Pretendard CSS variable을 활성화함**
  - 두 locale route가 공식 dynamic subset 92개와 `unicode-range` CSS를 self-host해 실제 glyph에 필요한 파일만 요청함
  - `PretendardStdVariable.woff2`와 `next/font/local`은 locale 없는 fixture로 범위를 제한함
  - 두 locale 모두 `font-display: swap`과 Arial 기반 fallback metric 보정을 사용함
- **Home·Tech·Invest의 영어·한국어 대표 route를 독립 font budget으로 고정함**
  - 영어 route의 decode 상한은 제품별 `40,000–95,000 bytes`, 전송 상한은 `45,000–100,000 bytes`임
  - 한국어 route의 decode 상한은 제품별 `320,000–380,000 bytes`, 전송 상한은 `330,000–400,000 bytes`임
  - 초기 stylesheet도 제품별 전송·decode 상한을 적용하며 `apps/web/initial-transfer-budget.json`이 소유함
- **두 locale에서 Pretendard typography를 유지하면서 전체 한국어 font의 초기 전송을 제거함**
  - 영어 decode 크기는 Home `91,844 bytes`, Tech·Invest `37,996 bytes`로 감소함
  - 한국어 decode 크기는 Home `375,888 bytes`, Tech `314,612 bytes`, Invest `311,860 bytes`로 기존보다 약 `81.7–84.8%` 감소함
  - 공통 dynamic subset stylesheet `59,318 bytes`도 초기 route 예산에 포함함
- **cold-cache browser 검증은 요청 개수 대신 실제 glyph에 따른 총 전송량을 요구함**
  - `PerformanceResourceTiming`으로 font·stylesheet·JavaScript의 전송 크기와 decode 크기를 분리함
  - dynamic subset 요청 수는 페이지 glyph에 따라 달라질 수 있으므로 총량과 적용 font family를 계약으로 검증함
  - Home·Tech·Invest의 영어·한국어 대표 route 6개가 변경 후 실제 측정을 통과함
