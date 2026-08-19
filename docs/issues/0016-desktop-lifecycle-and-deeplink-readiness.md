# Issue 0016: Electron 창 생명주기와 deep-link 준비도 보강

- 상태: 제안
- 우선순위: P2
- 기준일: 2026-08-19
- 참고 OSS: [`Mattermost Desktop`](https://github.com/mattermost/desktop)
- 영향 범위:
  [Electron main](../../apps/git-client/electron/main/index.ts),
  [window lifecycle](../../apps/git-client/electron/main/window-lifecycle.ts),
  [window lifecycle test](../../apps/git-client/electron/main/window-lifecycle.test.ts),
  [protocol](../../apps/git-client/electron/main/protocol.ts)

## 핵심 요약

- **현재 앱은 single-instance lock, macOS activate, OS별 window-all-closed와 workspace close interception을 구현함**
- **두 번째 실행은 기존 창을 복원하지만 전달된 argument나 deep link를 처리하지 않음**
- **먼저 현재 창·종료·재실행 계약을 package 환경에서 검증하고 deep link는 제품 요구가 있을 때만 활성화해야 함**
- **deep link를 도입할 경우 외부 문자열을 Git command로 직접 변환하지 않는 명시적 command schema가 필요함**
- **Mattermost의 다중 세션 규모를 복제하지 않고 OS event 처리와 신뢰 경계만 참고함**

## 현재 상태와 위험

- **기본 데스크톱 생명주기는 구현되어 있음**
  - 두 번째 instance가 기존 main window를 복원하고 focus함
  - macOS에서는 마지막 창을 닫아도 앱 process를 유지함
  - 앱 종료 전에 Git과 terminal utility를 dispose함
  - workspace close는 renderer command로 전달함
- **현재 single-instance test는 전달 payload가 없는 focus 동작에 한정됨**
  - file association이나 custom scheme 요구는 아직 명시되지 않음
  - cold start와 running instance event의 입력 경로가 다를 수 있음
- **child window와 utility를 포함한 반복 생명주기 검증이 필요함**
  - main window 재생성
  - Local History child window 종료
  - workspace close 취소와 app quit 구분

## 채택할 내용

- **지원 OS별 생명주기 matrix를 정의함**
  - cold start
  - second instance
  - main window close와 reopen
  - application quit
  - utility crash와 relaunch
  - update를 위한 종료
- **외부 진입점은 제품 요구가 생긴 뒤 별도 allowlist로 추가함**
  - custom scheme
  - file association
  - repository URL
  - branch·commit 식별자
- **deep-link 입력은 검증된 application command로 변환함**
  - scheme·host·path·query 제한
  - 길이와 encoding 제한
  - repository capability 확인
  - destructive action 자동 실행 금지

## 채택하지 않을 내용

- **현재 요구가 없는 custom protocol handler를 선제 등록하지 않음**
- **두 번째 instance의 raw argv를 renderer나 shell command로 전달하지 않음**
- **모든 창에 동일한 preload 권한을 부여하지 않음**
- **macOS·Windows·Linux의 종료 동작을 하나의 조건으로 단순화하지 않음**

## 실행 작업

- **현재 OS event와 main·child window 상태 전이를 표로 정리함**
- **focus·close·activate·quit·relaunch의 pure decision test를 보강함**
- **packaged app에서 main window close·reopen과 second instance를 검증함**
- **deep link 요구가 확정되면 parser와 command schema부터 추가하고 OS 등록을 마지막에 수행함**
- **지원하지 않는 외부 입력이 앱 상태를 바꾸지 않는 negative test를 유지함**

## 완료 조건

- **지원 OS별 창 종료와 app 종료 결과가 명시됨**
- **second instance가 중복 utility process를 생성하지 않음**
- **child window 종료와 main window 재생성에서 listener와 handler가 중복되지 않음**
- **deep link 미지원 상태에서는 외부 argument를 무시하고 안전하게 focus만 수행함**
- **향후 deep link를 도입할 경우 allowlist와 capability 검증 없이는 command가 실행되지 않음**

## 검증

- **unit과 package 생명주기를 함께 확인함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run test:electron`
  - 최종 `pnpm run check`
