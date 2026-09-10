# Issue 0024: 기술 문서 freshness와 근거 검증 보고서 도입

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `a9f5b6c`
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [content model](../../../../apps/web/lib/content-model.ts),
  [content repository](../../../../apps/web/lib/content-repository.ts),
  [content validation](../../../../apps/web/lib/content-validation.ts),
  [DocumentPageHeader](<../../../../apps/web/app/(tech)/_components/DocumentPageHeader.tsx>),
  [Tech content](../../../../apps/web/content/tech),
  [Web workflow](../../../../.github/workflows/web.yml)
- 참고 OSS:
  [GitHub Docs content linter](https://docs.github.com/en/contributing/collaborating-on-github-docs/using-the-content-linter),
  [MDN content](https://github.com/mdn/content),
  [MDN browser-compat-data](https://github.com/mdn/browser-compat-data)

## 핵심 요약

- **현재 문서는 `verifiedAt`과 `sourceUrl`을 표시해 최신성과 공식 근거를 제품 정보로 다룰 기반이 있음**
- **build는 schema·양 언어 일치·navigation·내부 링크를 검증하지만 외부 출처와 upstream 변화는 확인하지 않음**
- **오래된 문서를 즉시 배포 차단하기보다 scheduled report와 severity 기반 review queue로 운영하는 것이 적합함**
- **모든 문서에 동일한 만료 기간을 적용하지 않고 내용 유형과 upstream 변화 빈도에 따라 freshness 정책을 달리해야 함**
- **자동화 결과는 문서가 틀렸다고 단정하지 않고 사람이 다시 검토해야 할 근거로 제공해야 함**

## 처리 결과

- **문서 metadata와 source 성격에서 5개 freshness policy를 결정하는 report-only 도구를 추가함**
    - versioned technology 90일, upstream API 120일, imported source 180일, repository handbook 365일, evergreen concept 730일 기준을 적용함
- **일반 build와 PR 검증은 network에 의존하지 않고 주간 schedule에서만 제한된 병렬 요청과 8초 timeout으로 source를 확인함**
    - 정상·redirect·404/410·timeout/rate limit을 서로 다른 상태로 보고함
- **report는 warning과 review-required를 구분해 artifact로 제공하며 `verifiedAt`을 자동 변경하거나 배포를 차단하지 않음**
- **threshold 경계와 미검증 문서 분류를 결정적인 unit test로 고정함**

## OSS 기준에서 확인한 운영 패턴

- **GitHub Docs content linter는 오류와 경고를 분리해 merge 차단 여부를 규칙별로 결정함**
    - 구조적으로 확정 가능한 위반은 error로 처리함
    - 점진적으로 개선할 항목은 warning으로 유지함
- **MDN은 content와 machine-readable compatibility data를 분리하고 schema·source evidence로 정확성을 관리함**
- **채택할 핵심은 대규모 데이터 모델이 아니라 문서 주장과 검증 근거를 기계적으로 추적하는 방식임**

## 현재 저장소의 공백

- **`verifiedAt`은 ISO 날짜와 `updatedAt` 이후 여부만 검증됨**
    - 현재 날짜에서 얼마나 지났는지에 대한 정책이 없음
    - upstream이 변경되어도 검증일은 자동으로 review 대상이 되지 않음
- **`sourceUrl`은 안전한 HTTPS 형식만 검증됨**
    - 404, redirect loop, 삭제된 branch와 문서 이동을 감지하지 않음
    - 일시적 network 실패와 영구적인 source 소실을 구분하지 않음
- **양 언어 문서의 metadata 일치는 확인하지만 번역 본문의 검증 시점 차이를 표현할 수 없음**
- **문서 유형별 변화 속도가 다름**
    - 특정 runtime·framework 버전 문서는 빠르게 변할 수 있음
    - 원리·회고·직접 작성한 handbook은 동일한 주기로 확인할 필요가 없음

## 채택할 내용

- **문서 유형별 freshness policy를 정의함**
    - versioned technology
    - API 또는 공식 문서 연동
    - evergreen concept
    - imported 또는 translated source
    - repository-owned handbook
- **scheduled evidence report를 생성함**
    - `verifiedAt` 경과 기간과 policy threshold
    - source URL의 status와 redirect destination
    - 알려진 package·runtime version과 문서 version 차이
    - 한국어·영어 pair의 검증 상태 차이
    - 최근 성공 확인 시각과 반복 실패 횟수
- **severity를 운영 위험에 맞게 분리함**
    - error: schema 위반, 양 언어 필수 문서 누락, 확정된 내부 링크 오류
    - warning: freshness 초과, upstream version 변화, 일시적인 외부 source 실패
    - review-required: 반복된 source 소실 또는 명시된 지원 상태 변화
- **report를 CI artifact와 로컬 명령에서 동일하게 생성함**

## 채택하지 않을 내용

- **외부 URL의 일시적 실패만으로 PR을 차단하지 않음**
- **`verifiedAt`을 자동으로 현재 날짜로 갱신하지 않음**
- **upstream 최신 버전을 항상 권장 버전으로 간주하지 않음**
- **문서 본문을 자동 수정하거나 번역하지 않음**
- **모든 source에 무제한 network request를 보내지 않음**

## 실행 작업

- **현재 content를 유형별로 분류하고 freshness threshold 초안을 작성함**
- **source check의 timeout·redirect·cache·retry·rate-limit 정책을 정의함**
- **report-only 스크립트와 결정적인 fixture test를 추가함**
- **scheduled Web workflow에서 report artifact를 생성함**
- **반복적으로 안정된 규칙만 warning 또는 merge gate로 승격함**
- **문서 header에서 stale 상태를 사용자에게 노출할지 별도 제품 결정으로 검토함**

## 완료 조건

- **모든 기술 문서가 freshness policy 또는 명시적 예외에 연결됨**
- **source 소실·redirect·검증 기한 초과와 version drift가 report에서 구분됨**
- **network가 없는 로컬 build와 일반 PR 검증은 결정적으로 동작함**
- **scheduled check의 일시적 실패가 기존 문서 배포를 무조건 차단하지 않음**
- **reviewer가 어떤 문서를 왜 다시 확인해야 하는지 report만으로 판단할 수 있음**

## 검증

- **fixture 기반으로 외부 상태별 결과를 검증함**
    - 정상 source
    - 영구 redirect
    - 404 또는 삭제
    - timeout과 rate limit
    - freshness threshold 경계
    - 양 언어 metadata 차이
- **Web의 가까운 검증과 전체 검사를 실행함**
    - `pnpm --filter @jongminchung/web run typecheck`
    - `pnpm --filter @jongminchung/web run test`
    - `pnpm --filter @jongminchung/web run build`
    - 최종 `pnpm run check`
