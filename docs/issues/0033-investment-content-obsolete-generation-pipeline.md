# Issue 0033: Investment content의 obsolete 생성 pipeline 제거

- 상태: 구현 완료·반영 대기
- 우선순위: P1
- 기준일: 2026-08-20
- 영향 범위:
  [content repository](../../apps/web/lib/content-repository.ts),
  [Investment content model](../../apps/web/lib/invest/content.ts),
  [Investment content source](../../apps/web/lib/invest/source.ts),
  [generation utilities](../../apps/web/scripts/generation-utils.ts),
  [Web package](../../apps/web/package.json)

## 핵심 요약

- **Investment runtime이 과거 artifact 생성 CLI에서 source reader와 locale validator를 import함**
- **같은 CLI에는 consumer가 없는 generated manifest·loader 생성 코드가 남아 있음**
- **오류 메시지가 존재하지 않는 `investment:build` package script 실행을 안내함**
- **실제 runtime에 필요한 source parsing과 collection validation만 명확한 module로 남겨야 함**
- **도달 불가능한 생성 코드를 제거해 Investment content의 변경 경로를 하나로 축소하는 작업임**

## 현재 문제와 근거

- **runtime module에서 CLI module로 향하는 의존성이 있음**
  - `content-repository.ts`가 `scripts/build-investment-content.ts`의 `readInvestmentNotes`와 `validateInvestmentTranslations`를 사용함
  - 파일 이름과 실제 역할이 일치하지 않아 runtime owner를 찾기 어려움
- **generated artifact 경로에는 실제 consumer가 없음**
  - `build-investment-content.ts`가 `generated/investment-manifest.json`과 `generated/investment-loaders.ts`를 구성함
  - `apps/web/generated` 디렉터리가 존재하지 않음
  - production source와 package script가 generated manifest·loader를 읽거나 생성하지 않음
- **복구 안내와 실제 명령 계약이 불일치함**
  - stale artifact 오류는 `pnpm --filter @jongminchung/web run investment:build`를 안내함
  - `apps/web/package.json`에는 `investment:build` script가 없음
- **경로 해석이 실행 위치에 의존함**
  - `process.cwd()`가 `apps/web`로 끝나는지 검사해 app root를 결정함
  - module 위치가 고정되어 있음에도 호출한 작업 디렉터리에 따라 경로 계산 방식이 달라짐

## 채택할 내용

- **Investment source parsing과 collection validation을 실제 runtime module로 분리함**
  - MDX file discovery와 frontmatter parsing
  - metadata와 본문 component 계약 검증
  - locale pair와 공유 metadata 검증
  - source relative path 검증
- **content repository가 생성 CLI가 아닌 source module을 직접 사용하도록 함**
- **module 위치를 기준으로 content root와 workspace-relative path를 계산함**
- **source와 validation failure를 작은 fixture로 검증함**
  - locale 누락
  - 공유 metadata 불일치
  - path와 metadata ID 불일치
  - `SourceSummary`·`JamieNotes` section 누락

## 채택하지 않을 내용

- **consumer가 없는 manifest와 loader 생성을 package script로 되살리지 않음**
- **Investment content를 별도 workspace package로 추출하지 않음**
- **기술 문서와 Investment 문서의 서로 다른 metadata model을 하나의 거대한 schema로 합치지 않음**
- **runtime MDX 평가 방식이나 사용자 route를 이 이슈에서 변경하지 않음**
- **CI workflow를 추가하거나 변경하지 않음**

## 실행 작업

- **`readInvestmentNotes`와 translation validation을 명확한 source module로 이동함**
- **`content-repository.ts`의 import를 새 source 경계로 변경함**
- **generated file path·manifest·loader 구성과 CLI `main`을 제거함**
- **`generation-utils.ts`에서 consumer가 사라진 write·stale 비교 helper를 제거함**
- **파일 탐색과 POSIX path 정규화처럼 실제 consumer가 있는 helper만 유지함**
- **Investment source collection fixture test를 추가함**

## 완료 조건

- **production runtime이 `build-investment-content.ts`에 의존하지 않음**
- **저장소에 `generated/investment-*`와 `investment:build` 잔여 참조가 없음**
- **Investment content의 source owner와 validation owner를 파일 이름으로 식별할 수 있음**
- **잘못된 locale pair·metadata·path·본문 section이 fixture test에서 구분됨**
- **기존 Investment route와 MDX 렌더링 결과가 유지됨**

## 검증

- `rg -n 'build-investment-content|generated/investment|investment:build' apps/web`
- `pnpm --filter @jongminchung/web run typecheck`
- `pnpm --filter @jongminchung/web run test`
- `pnpm --filter @jongminchung/web run build`
- `pnpm run check`
- `git diff --check`

## 처리 결과

- **Investment source collection의 소유권을 `lib/invest/source.ts`로 분리함**
  - Fumadocs source를 manifest로 변환하고 locale pair·metadata·path·본문 section을 한 경계에서 검증함
  - `content-repository.ts`는 생성 script가 아닌 source module의 검증된 collection만 소비함
- **과거 생성 pipeline의 잔여 helper를 제거함**
  - consumer가 없는 generated file write·stale 비교·상대 경로 helper를 `generation-utils.ts`에서 제거함
  - Excalidraw가 실제 사용하는 결정적 file discovery helper만 유지함
- **작은 source fixture로 실패 원인을 구분함**
  - locale 누락·공유 metadata 불일치·metadata와 path 불일치·필수 section 누락을 각각 검증함
- **현재 Fumadocs source-first 구조에는 `generated/investment-*`와 `investment:build` 경로가 존재하지 않음**
  - module 위치가 고정된 source API를 사용하므로 실행 `cwd`에 따른 Investment path 분기가 없음
- **검증 결과는 Investment 관련 3개 파일·13개 test와 Web 전체 31개 파일·121개 test 통과임**
  - obsolete 생성 경로와 제거한 helper의 잔여 참조가 없음
  - Web typecheck와 production build가 통과함
