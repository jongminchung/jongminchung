# Issue 0025: 한영 기술 문서 검색 relevance benchmark 도입

- 상태: 제안
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

## OSS 기준에서 확인한 검색 패턴

- **Pagefind는 정적 사이트에 적합한 분할 index와 낮은 전송량을 목표로 함**
- **metadata 가중치와 title boost를 제공해 문서 본문보다 식별 정보를 우선할 수 있음**
- **`Intl.Segmenter`를 이용한 CJK query segmentation과 Web Worker 검색을 제공함**
- **CJK fuzzy substring과 mixed-language 검색에는 공개된 한계가 있어 실제 한국어 corpus 검증이 필요함**

## 현재 저장소의 공백

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
