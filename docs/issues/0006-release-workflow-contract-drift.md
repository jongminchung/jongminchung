# Issue 0006: 릴리스 workflow와 계약 테스트의 불일치 해소

- 상태: 진행 중
- 우선순위: P0
- 기준일: 2026-08-19
- 영향 범위:
  [릴리스 계약 테스트](../../apps/git-client/scripts/release-config.integration.test.ts),
  [package publish workflow](../../.github/workflows/publish-packages.yml),
  [version 삭제 script](../../.github/scripts/delete-version-ids-script.sh)

## 핵심 요약

- **과거 `jq select` 문자열에 결합된 assertion을 제거하고 현재 전용 version 삭제 script 계약으로 교체함**
- **manual trigger·package matrix·validation 선행·삭제·publish·인증 정리 순서를 observable contract로 검증함**
- **불명확한 테스트 제목을 실제 성공 조건을 설명하도록 정리함**
- **`pnpm run check`는 전체 통과 상태로 복구됨**
- **publish 후 integrity와 clean consumer 설치 검증은 아직 남아 있어 이슈를 완료 처리하지 않음**

## 진행 현황

- **workflow와 테스트의 stale 구현 결합을 해소함**
  - workflow test가 삭제 script 내부의 `jq` 표현을 중복 검사하지 않음
  - 삭제·publish·인증 cleanup 순서를 검증함
  - 전체 format·lint·typecheck·unit·integration 검사를 통과함
- **남은 범위는 실제 publish 결과 검증임**
  - registry가 반환하는 integrity 확인
  - clean consumer 설치와 subpath import 확인
  - 실제 외부 변경은 일반 PR test가 아니라 release workflow에서 수행함

## 확인한 문제와 근거

- **통합 테스트가 더 이상 존재하지 않는 구현 문자열에 결합되어 있었음**
  - `select(.name == "1.0.0")` 포함 여부를 직접 검사함
  - 현재 workflow는 `.github/scripts/delete-version-ids-script.sh`를 호출함
  - workflow와 script 중 어느 쪽이 canonical한지 테스트만으로 판단하기 어려움
- **해당 실패가 저장소 전체 검사 신뢰도를 낮추고 있었음**
  - unrelated change도 같은 실패를 만나 새 회귀와 기존 drift를 구분해야 함
  - CI 또는 로컬에서 `pnpm run check`를 green gate로 사용할 수 없음
- **일부 테스트 제목도 실제 계약을 설명하지 못하고 있었음**
  - 번역이 깨진 제목을 observable 성공 조건으로 교체함

## 채택할 내용

- **현재 고정 version publish 흐름을 canonical source와 대조함**
  - workflow의 manual trigger
  - package matrix와 고정 `1.0.0`
  - 기존 version 삭제
  - package publish
  - integrity와 consumer 설치 검증
  - 인증 정보 정리
- **테스트를 observable contract 중심으로 갱신함**
  - 전용 script 사용 여부는 workflow 연결 계약으로 검증함
  - version 삭제 자체는 script integration test에서 검증함
  - shell 내부 구현 문자열을 workflow test에서 중복 검사하지 않음
- **테스트 제목을 실제 성공·실패 조건으로 변경함**
  - 수동 publish workflow
  - 고정 version 교체
  - package integrity 검증
  - Electron release 구성

## 채택하지 않을 내용

- **테스트를 통과시키기 위해 workflow를 과거 `jq` 구현으로 되돌리지 않음**
- **실패 테스트를 skip하거나 integration project에서 제외하지 않음**
- **고정 `1.0.0` 배포 정책 자체를 이 이슈에서 변경하지 않음**
- **실제 GitHub Packages 삭제·publish를 일반 PR 테스트에서 실행하지 않음**

## 실행 작업

- **workflow와 script의 현재 동작을 대조함**
  - 입력 version과 package 이름 전달
  - 삭제 대상 식별과 404 처리
  - 오류 발생 시 publish 중단
  - 인증 설정과 cleanup
- **통합 테스트의 책임을 재배치함**
  - workflow test는 연결과 job 순서 검증
  - shell script test는 version 조회·삭제 결과 검증
  - release dry run은 외부 변경 없이 package 산출물 검증
- **stale assertion과 불명확한 테스트 제목을 정리함**

## 완료 조건

- **릴리스 계약 테스트가 현재 workflow와 script 역할을 정확히 반영함**
- **workflow 내부 구현을 동등한 방식으로 바꿔도 observable contract가 같으면 테스트가 유지됨**
- **version 삭제 실패가 publish 이전에 검출됨**
- **인증 정보 cleanup이 성공·실패 경로 모두에서 유지됨**
- **`pnpm run check`가 전체 통과함**

## 검증

- **가까운 통합 테스트부터 실행함**
  - `pnpm exec vitest run --project integration apps/git-client/scripts/release-config.integration.test.ts`
  - version 삭제 script에 대응하는 integration test
- **package release 경계를 확인함**
  - `pnpm --filter @jongminchung/ui run publish:dry-run`
  - `pnpm --filter @jongminchung/tooling run publish:dry-run`
  - `pnpm --filter @jongminchung/git-client run release:validate-local -- 1.0.0`
  - 최종 `pnpm run check`
