# Issue 0029: 발행된 기술 문서의 TODO와 asset 준비 계약 정리

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `7f4a72b`
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [Tech content](../../../../apps/web/content/tech),
  [content repository](../../../../apps/web/lib/content-repository.ts),
  [content validation](../../../../apps/web/lib/content-validation.ts),
  [validation fixtures](../../../../apps/web/scripts/content-validation.test.ts)

## 핵심 요약

- **`publicationStatus: published`인 한국어 문서 다섯 개에 owner 없는 발행 준비 TODO가 남아 있었음**
- **네 thumbnail TODO는 제거할 component·import와 지원되는 `image` frontmatter가 없어 stale 주석으로 판정함**
- **sample repository TODO가 가리킨 GitHub URL은 2026-08-19 기준 404이며 본문의 완료 주장도 근거가 없었음**
- **stale TODO 5개와 존재하지 않는 sample repository를 설명하는 문단을 제거함**
- **발행 문서의 MDX TODO·FIXME comment를 차단하고 draft·code fence·인용 예시는 허용하는 fixture를 추가함**

## 확인된 문제와 결론

- **thumbnail TODO 네 개는 현재 source 계약과 일치하지 않음**
    - 해당 위치에 제거할 thumbnail component와 import가 없음
    - `DocMetadata`는 `image` field를 지원하지 않음
    - 실제 thumbnail consumer와 asset 소유 규칙이 없음
    - 구현 요구가 아니라 이전 migration에서 남은 stale 주석으로 보고 제거함
- **`headless-react-component.mdx`의 sample repository는 존재하지 않음**
    - `https://github.com/kciter/headless-react-component-sample`이 404를 반환함
    - 최종 코드와 데모가 같은 구현을 사용한다는 문장도 검증 가능한 repository가 없어 제거함
    - 원격 repository를 자동 생성하거나 임의의 대체 링크를 만들지 않음

## 구현 결과

- **발행 문서의 blocking marker를 collection validation에 연결함**
    - MDX comment 형태의 `TODO`와 `FIXME`를 blocking marker로 취급함
    - `publicationStatus: published`에서만 실패함
    - draft 문서는 marker를 유지할 수 있음
- **교육용 예시와 실제 발행 부채를 구분함**
    - fenced code의 TODO는 무시함
    - 인용문의 TODO는 무시함
    - 일반 본문 문자열은 MDX comment가 아니므로 차단하지 않음
- **실패 메시지에 source relative path를 포함함**
    - 어느 문서가 발행 계약을 위반했는지 바로 확인할 수 있음

## 채택하지 않은 내용

- **consumer 없이 `image` metadata를 추가하지 않음**
- **원격 thumbnail을 build나 runtime에서 자동 다운로드하지 않음**
- **존재하지 않는 sample repository를 자동으로 생성하지 않음**
- **모든 `TODO` 문자열을 금지해 코드 예제와 기술 설명을 훼손하지 않음**
- **draft 작성 workflow까지 published 규칙으로 차단하지 않음**

## 완료 조건

- **발행 문서에 owner 없는 발행 준비 TODO가 없음**
- **존재하지 않는 외부 repository를 완료된 결과처럼 안내하지 않음**
- **published·draft·code fence·인용문 fixture가 서로 다른 결과를 보장함**
- **Web typecheck·unit test·production build와 전체 저장소 검사가 통과함**

## 검증

- `pnpm --filter @jongminchung/web run typecheck`
- `pnpm --filter @jongminchung/web run test`
- `pnpm --filter @jongminchung/web run build`
- `pnpm run check`
- `git diff --check`
