# Issue 0028: Web content runtime의 책임 경계와 fixture 검증 정리

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `7f4a72b`
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [content repository](../../../../apps/web/lib/content-repository.ts),
  [content validation](../../../../apps/web/lib/content-validation.ts),
  [content repository](../../../../apps/web/lib/content-repository.ts),
  [freshness report](0024-tech-content-freshness-evidence-report.md),
  [search benchmark](0025-bilingual-search-relevance-benchmark.md)

## 핵심 요약

- **기존 `build-content.ts` 526줄은 source parsing·validation·package API 검사·artifact 생성·CLI를 함께 소유함**
- **정적 검색 결과 실제 runtime은 source parsing과 document validation만 사용하고 생성 CLI·manifest·loader·search artifact에는 consumer가 없음**
- **도달 불가능한 생성 pipeline을 여러 파일로 보존하지 않고 제거해 실제 실행 경로만 남김**
- **source 정규화와 collection validation을 두 경계로 분리하고 `content-repository.ts`가 이를 직접 조합하도록 함**
- **locale·navigation·internal link와 outline·search text 계약을 작은 fixture 9개로 고정함**

## 확인된 실제 실행 경로

- **`content-repository.ts`가 MDX source를 읽고 runtime manifest와 검색 문서를 구성함**
    - `readDocuments`가 frontmatter·본문·outline을 정규화함
    - `validateDocuments`가 locale pair·navigation order·internal link를 검증함
    - `createSearchDocuments`가 요청 시 runtime 검색 문서를 구성함
- **기존 생성 artifact 경로는 실행되지 않음**
    - `apps/web/package.json`과 root script에 `build-content.ts` 호출이 없음
    - `apps/web/generated`와 `apps/web/public/search`는 존재하지 않음
    - generated loader·manifest를 import하는 runtime consumer가 없음
- **package API 검사는 구현만 존재하고 CLI에서도 호출되지 않음**
    - 활성화 시 현재 tooling 공개 symbol 8개가 문서 metadata에 없어 즉시 실패함
    - 사용되지 않는 검사를 보존하거나 조용히 CI gate로 활성화하지 않고 제거함

## 구현 결과

- **source 책임을 `content-source.ts`로 분리함**
    - MDX file discovery·frontmatter parsing·outline 생성·검색 본문 정규화를 소유함
    - `content-repository.ts`에 중복되어 있던 검색 본문 정규화를 제거함
- **collection 검증을 `content-validation.ts`로 분리함**
    - locale pair와 번역 metadata 일관성을 검증함
    - URL·navigation order·internal link를 검증함
- **도달 불가능 코드를 제거함**
    - `build-content.ts` CLI를 제거함
    - generated manifest·loader·search artifact 구성을 제거함
    - 호출되지 않던 TypeScript Compiler API 기반 package 검사를 제거함
- **fixture 검증을 추가함**
    - 정상 locale·section matrix
    - locale 누락과 번역 metadata 불일치
    - navigation order 중복과 gap
    - broken internal link
    - h2·h3 outline과 검색 본문 정규화

## 채택하지 않은 내용

- **도달 불가능한 pipeline을 source·validation·artifact 세 파일로 기계적으로 이동하지 않음**
- **consumer가 없는 generated manifest와 search index를 다시 생성하지 않음**
- **현재 metadata가 충족하지 않는 package API 검사를 예고 없이 build gate로 활성화하지 않음**
- **Web 전용 content 로직을 공용 workspace package로 추출하지 않음**
- **service container·class hierarchy·root barrel을 추가하지 않음**

## 완료 조건

- **runtime content owner가 source와 validation 경계를 직접 사용함**
- **중복된 검색 본문 정규화가 한 구현으로 통합됨**
- **대표 validation failure가 실제 content file 수정 없이 재현됨**
- **도달 불가능한 CLI·artifact·package audit 코드가 제거됨**
- **Web typecheck·unit test·production build와 전체 저장소 검사가 통과함**

## 검증

- `pnpm --filter @jongminchung/web run typecheck`
- `pnpm --filter @jongminchung/web run test`
- `pnpm --filter @jongminchung/web run build`
- `pnpm run check`
- `git diff --check`
