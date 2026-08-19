# Issue 0025: 한영 기술 문서 검색 relevance benchmark 도입

- 상태: 완료
- 우선순위: P2
- 기준일: 2026-08-19
- 영향 범위:
  [Tech search](../../apps/web/lib/tech/search.ts),
  [content repository](../../apps/web/lib/content-repository.ts),
  [content source](../../apps/web/scripts/content-source.ts),
  [content model](../../apps/web/lib/content-model.ts),
  [document discovery E2E](<../../apps/web/app/(tech)/document-discovery.e2e.test.ts>),
  [Tech content](../../apps/web/content/tech)
- 참고 OSS:
  [Pagefind](https://github.com/Pagefind/pagefind),
  [Pagefind changelog](https://github.com/Pagefind/pagefind/blob/main/CHANGELOG.md),
  [Pagefind CJK substring 논의](https://github.com/Pagefind/pagefind/issues/987)

## 핵심 요약

- **현재 검색은 title·API symbol·heading·tag·description·body에 가중치를 주지만 exact·prefix·substring 일치에만 의존함**
- **한국어 띄어쓰기·한영 혼합·오타·복합어에서 실제 검색 성공률을 설명할 corpus와 품질 기준이 없음**
- **검색 엔진 교체보다 대표 질의와 기대 결과를 먼저 고정해 현재 구현과 OSS 후보를 같은 기준으로 비교해야 함**
- **Pagefind의 metadata weighting·CJK segmentation·Web Worker 패턴은 유용하지만 CJK 부분 문자열 한계가 있어 무검증 교체는 적절하지 않음**
- **완료 기준은 특정 library 도입이 아니라 사용자가 원하는 문서를 상위 결과에서 안정적으로 찾는 것임**

## 처리 결과

- **`Intl.Segmenter` 기반 한영 혼합 query tokenization과 공백·구두점 차이를 흡수하는 compact match를 추가함**
- **일부 term만 일치하는 문서는 coverage 제곱으로 감점해 정확한 API·title 일치를 우선하도록 개선함**
- **실제 기술 문서에 연결된 한영 query corpus 40개와 deterministic threshold를 추가함**
  - 영어 20개와 한국어 20개로 구성됨
  - 자연어·한영 혼합·무공백 한국어·`createProgram`·`noUncheckedIndexedAccess` 같은 정확 API명·부분 일치·명시적 no-result를 포함함
- **검색 품질 baseline을 locale별로 고정함**
  - 전체 top-1은 `91.67%`, top-3는 `100%`, MRR은 `95.83%`로 측정됨
  - 영어 top-1은 `94.44%`, MRR은 `97.22%`로 측정됨
  - 한국어 top-1은 `88.89%`, MRR은 `94.44%`로 측정됨
  - 명시적 no-result accuracy는 `100%`, positive query의 unexpected zero-result는 `0%`로 측정됨
- **built-in 검색의 asset·index 비용 baseline을 품질 gate와 함께 고정함**
  - 직렬화된 한영 search index는 `1,040,636 bytes`로 측정됨
  - 초기 index 요청은 locale별 1회이며 추가 검색 runtime dependency는 `0 bytes`임
  - index 상한 `1,100,000 bytes`와 runtime dependency 상한 `0 bytes`를 초과하면 회귀 test가 실패함
- **Pagefind 전환은 현재 corpus 규모에서 운영 복잡도와 CJK 부분 문자열 위험을 정당화하지 못해 채택하지 않음**

## OSS 기준에서 확인한 검색 패턴

- **Pagefind는 정적 사이트에 적합한 분할 index와 낮은 전송량을 목표로 함**
- **metadata 가중치와 title boost를 제공해 문서 본문보다 식별 정보를 우선할 수 있음**
- **`Intl.Segmenter`를 이용한 CJK query segmentation과 Web Worker 검색을 제공함**
- **CJK fuzzy substring과 mixed-language 검색에는 공개된 한계가 있어 실제 한국어 corpus 검증이 필요함**

## 처리 전 저장소의 공백

- **query는 NFKC와 lowercase 처리 뒤 whitespace로만 분리됨**
  - 띄어쓰기가 없는 한국어 문장은 하나의 긴 term이 됨
  - 형태가 조금 다른 용어와 일반적인 오타는 결과가 0이 될 수 있음
- **문서 metadata와 본문을 하나의 합산 score로 처리함**
  - 여러 낮은 가치의 본문 일치가 하나의 정확한 API symbol 일치와 경쟁할 수 있음
  - 여러 term 중 일부만 일치해도 높은 결과가 될 수 있음
- **검색 품질 회귀 test가 UI 동작 중심임**
  - 기대 문서의 순위와 zero-result 비율을 장기간 비교할 baseline이 없음
  - 한국어와 영어 검색 품질이 독립적으로 측정되지 않음

## 채택할 내용

- **실제 제품 질의를 대표하는 benchmark corpus를 작성함**
  - 한국어 자연어
  - 영어 기술 용어
  - API·package·version 이름
  - 한영 혼합 query
  - 띄어쓰기와 흔한 오타 변형
  - 정확한 결과가 없어야 하는 query
- **정량 지표를 정의함**
  - top-1과 top-3 hit rate
  - mean reciprocal rank
  - zero-result rate
  - query별 index download와 응답 시간
  - locale 간 품질 차이
- **현재 구현을 개선하는 작은 실험과 Pagefind pilot을 같은 corpus로 비교함**
  - `Intl.Segmenter` 기반 term 분리
  - alias와 synonym metadata
  - 모든 term 일치와 일부 term 일치의 구분
  - field별 score normalization
  - highlight와 snippet 정확성
- **선택한 결과를 deterministic test와 크기 budget으로 고정함**

## 채택하지 않을 내용

- **benchmark 없이 현재 검색을 Pagefind로 즉시 교체하지 않음**
- **한국어 형태소 분석 서버나 외부 검색 SaaS를 첫 단계에 추가하지 않음**
- **오타 허용 범위를 넓혀 무관한 문서를 상위에 노출하지 않음**
- **검색 index에 비공개 metadata나 원문 외 데이터를 포함하지 않음**
- **문서 수가 적은 현재 상태에서 복잡한 ranking model을 도입하지 않음**

## 실행 작업

- **한국어·영어 대표 query 30~50개와 기대 순위를 정의함**
- **현재 검색 결과를 baseline report로 저장함**
- **segmentation·synonym·term coverage 개선을 각각 독립적으로 실험함**
- **Pagefind pilot의 검색 품질·index 크기·초기 요청 수를 측정함**
- **개선 폭과 운영 복잡도를 비교해 기존 구현 유지 또는 engine 전환을 결정함**
- **선택한 ranking 계약을 unit test와 browser test로 추가함**

## 완료 조건

- **한국어와 영어의 top-3 hit rate와 zero-result baseline이 존재함**
- **검색 변경 PR에서 relevance와 asset 증감을 비교할 수 있음**
- **띄어쓰기 없는 한국어와 정확한 API 이름의 기대 문서가 안정적으로 노출됨**
- **검색 결과 없음과 일부 term 일치가 사용자에게 구분됨**
- **채택한 구현의 bundle·index 비용이 `0008`의 성능 예산과 연결됨**

## 검증

- **검색 corpus와 browser 사용자 여정을 함께 검증함**
  - `pnpm --filter @jongminchung/web run test`
  - `pnpm --filter @jongminchung/web run build`
  - document discovery E2E
  - production asset와 search index 크기 측정
- **최종 `pnpm run check`, `git diff --check`, `git status --short`를 실행함**

## 최종 선택

- **현재 built-in 검색을 유지함**
  - 별도 client 검색 library가 없어 runtime asset 증가가 없음
  - 전체와 locale별 relevance가 고정 threshold를 충족함
  - query corpus와 index byte baseline을 같은 test에서 비교할 수 있음
- **Pagefind 도입은 corpus 기준으로 재평가 가능한 후보로만 유지함**
  - 향후 문서 증가로 built-in index가 `1,100,000 bytes`를 넘거나 초기 전송 비용이 성능 예산을 위협할 때 pilot 필요함
  - pilot은 동일 40개 corpus에서 locale별 relevance를 먼저 통과한 뒤 worker·분할 index asset 절감이 확인될 때만 채택 가능함
