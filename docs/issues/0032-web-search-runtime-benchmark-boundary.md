# Issue 0032: Web 검색 runtime과 benchmark 실행 경계 분리

- 상태: 구현 완료·반영 대기
- 우선순위: P1
- 기준일: 2026-08-20
- 영향 범위:
  [검색 runtime](../../apps/web/lib/tech/search.ts),
  [검색 benchmark 정의](../../apps/web/lib/tech/search-benchmark.ts),
  [실제 corpus benchmark](../../apps/web/lib/tech/search-benchmark.integration.test.ts),
  [검색 UI](<../../apps/web/app/(tech)/_components/SearchDialog.tsx>)

## 핵심 요약

- **현재 `search.ts`가 사용자 검색 runtime과 benchmark 평가·비용 측정·threshold 검증을 함께 소유함**
- **검색 UI는 runtime API만 사용하지만 같은 module에 제품에서 사용하지 않는 benchmark 책임이 포함됨**
- **실제 40개 문서를 읽는 benchmark가 unit test로 분류되어 coverage 계측에서 10초 timeout이 재현됨**
- **작은 검색 fixture는 unit test로 유지하고 실제 corpus 품질 검증은 integration test로 분리해야 함**
- **CI workflow 변경 없이 앱 module과 test 실행 경계만 정리하는 작업임**

## 현재 문제와 근거

- **`search.ts` 364줄에 서로 다른 변경 이유가 결합되어 있음**
    - tokenization·field score·snippet·결과 정렬은 제품 runtime 책임임
    - top-k·MRR·zero-result 평가와 index 비용·threshold 검증은 benchmark 책임임
    - `SearchDialog`는 `searchDocuments`와 `SearchHit`만 사용함
- **실제 corpus benchmark가 unit test의 시간 계약과 맞지 않음**
    - `readContentSnapshot`으로 모든 MDX source를 읽고 outline과 검색 본문을 구성함
    - 40개 query를 전체·영어·한국어로 반복 평가함
    - `vitest` coverage 실행에서 첫 corpus test가 약 11.7초 소요되어 unit test의 10초 제한을 초과함
- **일반 Web test 통과만으로 root unit coverage 계약을 증명할 수 없음**
    - `pnpm --filter @jongminchung/web run test`는 22개 파일·85개 test가 통과함
    - coverage를 사용하는 unit 실행에서는 동일 test가 timeout으로 실패함

## 채택할 내용

- **제품 검색 module에는 브라우저에서 사용하는 API만 유지함**
    - query tokenization
    - field score와 match 선택
    - snippet과 결과 정렬
    - `SearchHit`·`SearchMatch` 계약
- **benchmark runner를 별도 module로 분리함**
    - benchmark case와 report type
    - relevance 평가
    - search index 비용 측정
    - threshold 검증
- **test 종류를 실행 비용에 맞게 분류함**
    - 작은 in-memory fixture는 `search.test.ts` unit test로 유지함
    - 실제 MDX corpus는 `search-benchmark.integration.test.ts`로 이동함
    - corpus와 locale별 search document는 test 생명주기에서 한 번만 구성함

## 채택하지 않을 내용

- **검색 engine이나 ranking weight를 이 이슈에서 변경하지 않음**
- **현재 40개 bilingual query corpus와 baseline 수치를 다시 정의하지 않음**
- **timeout 숫자만 늘려 runtime과 benchmark 책임 혼합을 유지하지 않음**
- **Pagefind·외부 검색 SaaS 또는 새 runtime dependency를 추가하지 않음**
- **GitHub Actions workflow와 artifact 구성을 변경하지 않음**

## 실행 작업

- **`search.ts`에서 benchmark 전용 type과 함수를 새 runner module로 이동함**
- **benchmark corpus 정의가 runner type만 참조하도록 import graph를 정리함**
- **실제 corpus test를 integration suffix로 변경함**
- **unit test는 검색 함수의 deterministic 동작만 작은 fixture로 검증함**
- **integration test는 전체·영어·한국어 baseline과 index byte budget을 계속 검증함**

## 완료 조건

- **검색 UI의 production import graph에 benchmark runner가 포함되지 않음**
- **unit test가 실제 MDX corpus 전체를 읽지 않음**
- **integration test가 40개 query와 locale별 baseline을 유지함**
- **coverage unit 실행에서 Web 검색 test가 timeout을 발생시키지 않음**
- **검색 결과와 serialized index byte baseline이 변경되지 않음**

## 검증

- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm --filter @jongminchung/web run typecheck`
- `pnpm --filter @jongminchung/web run test`
- `pnpm --filter @jongminchung/web run build`
- `git diff --check`

## 처리 결과

- **제품 검색 규칙을 `search.ts`의 순수 runtime API로 분리함**
    - Unicode 정규화·질의 분해·별칭·결과 필터·source interleave가 Fumadocs source와 benchmark 정의에 의존하지 않음
    - 작은 in-memory fixture가 제품 검색 규칙을 unit project에서 검증함
- **실제 bilingual corpus benchmark는 integration project로 이동함**
    - `search-benchmark.integration.test.ts`가 별도 server runner를 한 번 실행해 40개 query와 기존 품질 baseline을 검증함
    - unit coverage 실행은 실제 MDX corpus와 server index를 읽지 않음
- **검색 UI의 production import graph에는 benchmark case·threshold·평가 runner가 포함되지 않음**
- **검증 결과는 unit 5개·integration corpus 1개와 Web 전체 31개 파일·121개 test 통과임**
    - root unit coverage 142개 파일·747개 test와 integration 37개 파일·281개 test도 통과함
    - Web typecheck와 production build가 통과함
