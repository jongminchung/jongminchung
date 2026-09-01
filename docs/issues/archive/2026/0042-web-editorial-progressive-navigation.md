# Issue 0042: Web editorial 목록의 점진적 탐색과 모션 계약 보강

- 상태: 완료
- 완료일: 2026-08-29
- 우선순위: P2
- 기준일: 2026-08-29
- 기준 commit: `b3badda`
- 영향 범위:
  [editorial 목록](../../../../apps/web/components/EditorialIndex.tsx),
  [무한 목록 controller](../../../../apps/web/components/EditorialInfiniteResults.tsx),
  [Tech blog copy](<../../../../apps/web/app/(tech)/_components/BlogIndex.tsx>),
  [맨 위 이동 control](<../../../../apps/web/app/(tech)/_components/BackToTopButton.tsx>),
  [Tech browser test](<../../../../apps/web/app/(tech)/tech.e2e.test.ts>)

## 핵심 요약

- **Tech editorial 목록이 첫 9개 이후 콘텐츠를 JavaScript와 `IntersectionObserver`에만 의존해 비활성화·미지원 환경에서 다음 페이지를 탐색할 수 없었음**
- **서버 HTML에 현재 filter·sort·view를 보존하는 실제 다음 페이지 링크를 추가하고 지원 환경에서는 기존 자동 로딩을 유지함**
- **자동 로딩으로 공개된 페이지 수와 URL의 `page` 값을 계속 동기화해 새로고침과 공유 동작을 보존함**
- **맨 위 이동은 `prefers-reduced-motion`이 활성화되면 smooth scroll 대신 즉시 이동하도록 변경함**
- **정적 markup test와 JavaScript 비활성화 browser test를 추가하고 검색 재시도 E2E의 요청 경쟁 조건도 안정화함**

## 발견한 문제와 영향

- **무한 목록의 다음 콘텐츠에 도달하는 명시적 링크가 없었음**
  - Server Component가 첫 page 크기만 렌더링하므로 JavaScript를 실행하지 않으면 이후 글이 HTML에 포함되지 않음
  - `IntersectionObserver`가 없는 환경에서는 effect가 예외를 발생시키고 사용자가 선택할 수 있는 대체 경로도 없었음
  - screen reader와 keyboard 사용자는 자동 관찰이 실행되기 전 다음 묶음의 목적지를 확인할 수 없었음
- **sentinel의 상태 문구가 실제 네트워크 로딩 상태와 일치하지 않았음**
  - 모든 editorial item은 이미 component 입력으로 전달되며 다음 묶음 공개는 local state 변경임
  - 계속 표시되는 로딩 문구보다 실제 `Load more` 링크가 현재 가능한 동작을 정확히 설명함
- **맨 위 이동이 사용자 모션 설정과 관계없이 smooth scroll을 사용했음**
  - 기존 접근성 환경 matrix는 transition과 animation을 검사하지만 imperative scroll behavior까지 제한하지 않음
  - 모션 감소 설정에서는 즉시 이동이 사용자 의도에 더 부합함
- **검색 오류 재시도 E2E가 첫 요청 한 건만 실패한다고 가정했음**
  - search dialog 초기화 과정에서 동일 검색 요청이 둘 이상 발생하면 두 번째 요청이 성공해 오류 UI assertion이 간헐적으로 실패할 수 있음
  - 재시도 전 실패 상태와 재시도 후 성공 상태를 test가 직접 소유해야 함

## 채택한 구현

- **무한 목록 sentinel에 실제 다음 페이지 anchor를 렌더링함**
  - `EditorialIndex`가 현재 query를 기준으로 초기 다음 페이지 `href`를 계산함
  - `EditorialInfiniteResults`가 공개된 page 증가에 맞춰 링크의 `page` parameter를 갱신함
  - tag·sort·view parameter와 hash는 다음 페이지 링크에서 유지함
- **자동 로딩은 progressive enhancement로 유지함**
  - `IntersectionObserver`가 있으면 기존 `600px` root margin에서 다음 묶음을 자동 공개함
  - API가 없으면 observer를 만들지 않고 anchor가 유일하고 완전한 탐색 경로가 됨
  - 자동 공개 뒤 `history.replaceState`로 URL을 갱신해 새로고침 시 같은 공개 범위를 복원함
- **목록 끝은 동작 링크 대신 완료 status로 구분함**
  - 다음 항목이 있으면 localized `loadMore` copy를 가진 anchor를 제공함
  - 모든 항목이 공개되면 localized 완료 문구를 `role="status"`로 제공함
  - 실제 비동기 loading state가 아니었던 `loading` copy와 prop을 제거함
- **imperative scroll이 사용자 설정을 확인하도록 변경함**
  - `window.matchMedia("(prefers-reduced-motion: reduce)")`가 일치하면 `behavior: "auto"`를 사용함
  - 일치하지 않으면 기존 `behavior: "smooth"`를 유지함
- **검색 재시도 test가 오류 상태의 수명을 명시적으로 제어함**
  - retry action 전의 모든 검색 요청을 `503`으로 응답함
  - retry action 직전에 성공 응답으로 전환함
  - 초기 요청 횟수와 무관하게 오류 UI → 재시도 → 결과 UI 계약을 검증함

## 채택하지 않은 범위

- **무한 목록을 전부 수동 pagination으로 전환하지 않음**
  - 기존 자동 탐색 경험과 URL 동기화는 유지함
  - anchor는 자동 로딩을 대체하지 않고 비활성화·미지원 환경의 복구 경로를 제공함
- **`IntersectionObserver` polyfill을 추가하지 않음**
  - 제품 동작은 표준 anchor만으로 완결되므로 추가 JavaScript dependency가 필요하지 않음
- **맨 위 이동을 native `#top` anchor로 바꾸는 구조 변경은 포함하지 않음**
  - Server Component와 작은 client island 경계 단순화는 활성 이슈 [`0040`](../../0040-web-tech-starlight-inspired-maintainability.md)이 소유함
  - 이번 범위는 기존 control의 모션 설정 위반만 수정함
- **디자인 token과 visual 표현형은 변경하지 않음**
  - 공용 디자인 시스템과 세 site 표현형은 활성 이슈 [`0041`](../../0041-web-openai-reference-design-system-application.md)이 소유함

## 구현 결과

- **JavaScript 활성 환경에서 기존 자동 무한 스크롤과 URL 복원 동작이 유지됨**
  - 첫 page에 9개 항목과 `page=2` anchor가 렌더링됨
  - sentinel 접근 시 18개 항목으로 늘고 URL이 `page=2`로 갱신됨
  - 새로고침 뒤 18개 항목이 다시 렌더링됨
- **JavaScript 비활성 환경에서 이후 글을 연속 탐색할 수 있음**
  - 서버 HTML의 `Load more` 링크가 현재 sort·view와 `page=2`를 포함함
  - 다음 URL 응답은 첫 두 page에 해당하는 18개 항목을 렌더링함
- **observer API가 없는 환경에서도 runtime exception 없이 링크가 유지됨**
- **모션 감소 환경에서 맨 위 이동이 smooth animation 없이 수행됨**
- **검색 재시도 test가 초기 중복 요청과 관계없이 안정적으로 오류와 복구를 검증함**

## 완료 조건

- **초기 server markup에 query state를 보존하는 다음 페이지 링크가 존재함**
- **JavaScript 비활성 상태에서 첫 page와 다음 page의 항목 수가 연속적으로 증가함**
- **JavaScript 활성 상태에서 자동 공개·URL 동기화·새로고침 복원이 유지됨**
- **`IntersectionObserver`가 없어도 목록 탐색이 가능함**
- **맨 위 이동이 `prefers-reduced-motion`을 존중함**
- **검색 오류 재시도 E2E가 요청 횟수 경쟁 조건 없이 통과함**

## 검증

- **Web 정적 검사와 component test를 통과함**
  - `pnpm --filter @jongminchung/web run typecheck`
  - `pnpm --filter @jongminchung/web run test`
  - 결과: 35개 test file, 138개 test 통과함
- **production build 기반 Tech browser test를 통과함**
  - `pnpm --filter @jongminchung/web exec playwright test tech.e2e.test.ts --project tech-chromium`
  - 결과: JavaScript 비활성화 시나리오를 포함한 14개 test 통과함
- **변경 파일 품질 검사를 통과함**
  - `pnpm exec oxfmt --config oxfmt.config.ts <changed-files>`
  - `pnpm exec oxlint --config oxlint.config.ts <changed-files>`
  - `git diff --check`
