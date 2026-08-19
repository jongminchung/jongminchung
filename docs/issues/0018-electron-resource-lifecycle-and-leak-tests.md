# Issue 0018: Electron 리소스 생명주기와 누수 회귀 검증

- 상태: 완료
- 우선순위: P2
- 기준일: 2026-08-19
- 참고 OSS:
  [`VS Code Writing Tests`](https://github.com/microsoft/vscode/wiki/Writing-Tests),
  [`VS Code smoke test`](https://github.com/microsoft/vscode/blob/main/test/smoke/README.md)
- 영향 범위:
  [Electron main](../../apps/git-client/electron/main/index.ts),
  [Git utility](../../apps/git-client/electron/utility/git),
  [terminal utility](../../apps/git-client/electron/utility/terminal),
  [desktop stream](../../apps/git-client/electron/main/desktop-stream-hub.ts),
  [Electron tests](../../apps/git-client/electron-tests)

## 핵심 요약

- **현재 utility server·repository watcher·terminal session·desktop stream에 명시적 dispose 구현과 단위 테스트가 존재함**
- **개별 dispose의 정확성과 여러 창·repository·process를 반복 생성한 뒤 기준 상태로 돌아오는지는 다른 계약임**
- **VS Code의 disposable leak 검사처럼 소유자가 생성한 자원을 같은 생명주기에서 해제하도록 검증해야 함**
- **메모리 수치 하나보다 listener·watcher·PTY·child process·temporary path의 개수를 안정적인 지표로 사용함**
- **package test는 반복 횟수를 제한하고 상세 stress test는 주기 실행으로 분리해야 함**

## 현재 상태와 위험

- **여러 native resource가 이미 명시적으로 정리됨**
  - Git·terminal utility process의 dispose
  - repository watcher의 멱등적 dispose
  - PTY event subscription과 session 종료
  - window close 시 desktop stream과 platform handler 해제
  - CodeMirror·xterm renderer resource 해제
- **통합 생명주기는 resource 종류를 교차함**
  - repository를 닫아도 child Git process가 종료 중일 수 있음
  - main window 재생성 시 session-level handler와 window-level handler의 수명이 다름
  - Local History child window가 별도 preload와 IPC 등록을 사용함
- **일회성 성공 테스트는 누적 회귀를 찾기 어려움**
  - listener 중복
  - watcher 잔존
  - orphan utility 또는 PTY process
  - 닫힌 window로 전송되는 stream event
  - 재사용되지 않는 temporary directory

## 채택할 내용

- **resource owner와 dispose trigger를 명시함**
  - application
  - main window와 child window
  - repository session
  - Git operation
  - terminal session
  - renderer component
- **관찰 가능한 leak indicator를 정의함**
  - child process와 PTY 개수
  - active repository watcher 개수
  - IPC·stream subscriber 개수
  - BrowserWindow 개수
  - temporary resource와 lock
- **반복 생명주기 test를 계층화함**
  - unit에서 dispose 멱등성과 late event 무시
  - integration에서 repository·terminal 반복 open/close
  - packaged smoke에서 window reopen과 app quit
  - 주기 stress test에서 더 많은 반복과 crash recovery

## 채택하지 않을 내용

- **불안정한 전체 heap 크기만으로 pass·fail을 결정하지 않음**
- **모든 listener에 global registry를 강제하지 않음**
- **종료 시간을 줄이기 위해 child process를 확인 없이 강제 종료하지 않음**
- **긴 stress test를 모든 PR의 필수 gate로 바로 추가하지 않음**

## 실행 작업

- **resource 종류별 owner·create·dispose·failure path를 inventory함**
- **기존 dispose test에 late message·double dispose·partial startup failure를 추가함**
- **repository와 terminal을 반복해서 열고 닫는 integration test를 추가함**
- **packaged app의 close·activate·quit 뒤 orphan process가 없는지 확인함**
- **초기 baseline과 false positive를 확인한 뒤 PR gate와 scheduled test 범위를 나눔**

## 완료 조건

- **모든 장기 실행 resource에 단일 owner와 종료 trigger가 있음**
- **dispose가 멱등적이며 종료 뒤 late event가 UI나 닫힌 port로 전달되지 않음**
- **반복 open·close 뒤 watcher·listener·PTY·window 수가 baseline으로 돌아옴**
- **utility crash와 startup partial failure에서도 이미 생성된 resource가 정리됨**
- **PR용 test는 안정적인 시간 안에 완료되고 장기 stress는 별도 주기로 실행됨**

## 검증

- **가까운 lifecycle test부터 package test까지 실행함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run test:integration:native`
  - `pnpm --filter @jongminchung/git-client run test:electron`
  - 최종 `pnpm run check`

## 처리 결과

- **application·window·repository·operation·terminal별 owner와 dispose 경계를 기존 구현에서 확인함**
  - application은 Git·terminal utility를 소유하고 `before-quit`에서 함께 정리함
  - window는 stream·menu·platform handler를 소유하고 `closed`에서 정리함
  - repository와 terminal service는 watcher·child process·PTY를 각 session 종료에서 정리함
- **desktop stream의 late event와 double dispose 회귀를 보강함**
  - dispose 이후 늦게 도착한 connection port를 즉시 닫음
  - dispose를 반복해도 disconnect callback과 IPC cleanup이 중복되지 않음
  - 닫힌 port로 publish하거나 late close가 발생해도 추가 event가 전달되지 않음
