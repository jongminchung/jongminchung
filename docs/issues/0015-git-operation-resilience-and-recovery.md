# Issue 0015: Git 작업 상태와 실패 복구 계약 통합

- 상태: 제안
- 우선순위: P1
- 기준일: 2026-08-19
- 참고 OSS: [`GitHub Desktop`](https://github.com/desktop/desktop)
- 영향 범위:
  [Git utility](../../apps/git-client/electron/utility/git),
  [Git bridge](../../apps/git-client/src/bridge/ElectronGitBridge.ts),
  [operation E2E](../../apps/git-client/electron-tests/operation-matrix.spec.ts),
  [recovery E2E](../../apps/git-client/electron-tests/remote-recovery-ui.spec.ts),
  [Changes feature](../../apps/git-client/src/features)

## 핵심 요약

- **현재 앱은 광범위한 Git operation·conflict·recovery 기능과 상태 oracle 테스트를 이미 보유함**
- **작업별로 분산된 progress·cancel·retry·recovery 표현을 공통 사용자 계약으로 정리할 필요가 있음**
- **GitHub Desktop에서 채택할 핵심은 UI 구조가 아니라 실패를 분류하고 다음 행동을 안내하는 방식임**
- **destructive operation은 실행 전 예상 변화와 실패 후 repository 실제 상태를 함께 검증해야 함**
- **완료 기준은 모든 오류를 자동 복구하는 것이 아니라 안전하게 중단하고 재확인 가능한 상태를 만드는 것임**

## 현재 상태와 위험

- **Git 실행은 repository capability와 utility process로 격리됨**
  - operation command의 argument validation이 존재함
  - repository close와 utility crash 시 cancellation을 처리함
  - merge·rebase·cherry-pick·revert의 진행 상태와 abort를 지원함
- **recovery 기능은 이미 여러 domain service에 존재함**
  - conflict recovery
  - ref transaction과 snapshot
  - shelf·changelist·local history
  - remote operation recovery
- **기능별 상태와 message가 독립적으로 발전하면 사용자 행동이 불일치할 수 있음**
  - 어떤 실패는 retry가 가능하고 어떤 실패는 refresh가 먼저 필요함
  - 작업 완료 직후 repository refresh 범위가 operation마다 달라질 수 있음
  - process crash 뒤 UI의 pending state가 실제 Git 상태와 어긋날 수 있음

## 채택할 내용

- **공통 operation 상태를 사용자 관점에서 정의함**
  - queued
  - running과 progress
  - cancelling
  - succeeded
  - failed-retryable
  - failed-needs-user-action
  - recovered 또는 abandoned
- **오류를 다음 행동 기준으로 분류함**
  - 인증과 network
  - conflict와 in-progress Git state
  - stale repository state
  - invalid input과 capability
  - utility crash와 timeout
  - disk·permission·lock
- **작업 종료 뒤 Git 상태를 oracle로 재확인함**
  - HEAD와 refs
  - index와 working tree
  - in-progress marker
  - remote tracking state
  - recovery snapshot과 temporary data

## 채택하지 않을 내용

- **실패한 write operation을 조건 없이 자동 재시도하지 않음**
- **오류 message 문자열 하나를 application state로 사용하지 않음**
- **GitHub Desktop의 대형 store나 기존 React 구조를 복제하지 않음**
- **모든 Git command를 동일한 progress 단위로 표현하지 않음**

## 실행 작업

- **현재 operation별 상태·취소·오류·refresh·recovery 동작을 matrix로 inventory함**
- **공통 상태와 error category를 기존 contract 위에서 정규화함**
- **대표 read·write·network·conflict operation에 동일한 UI feedback 원칙을 적용함**
- **utility crash와 앱 재실행 뒤 repository 실제 상태를 다시 읽는 회귀 test를 추가함**
- **destructive operation의 preview·confirmation·result oracle 연결을 확인함**

## 완료 조건

- **대표 operation이 공통 상태와 오류 category를 사용함**
- **cancel·timeout·crash 뒤 pending UI가 남지 않음**
- **retry 가능한 실패와 사용자 조치가 필요한 실패가 구분됨**
- **write operation 결과가 UI 성공 표시뿐 아니라 실제 Git 상태로 검증됨**
- **recovery 실패 시 원본 repository와 recovery evidence를 보존함**

## 검증

- **Git domain과 실제 Electron 경계를 함께 확인함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run test:integration:native`
  - `pnpm --filter @jongminchung/git-client run test:electron:prebuilt`
  - 최종 `pnpm run check`
