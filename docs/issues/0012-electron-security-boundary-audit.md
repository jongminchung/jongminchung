# Issue 0012: Electron 보안 경계와 권한 정책 감사

- 상태: 진행 중
- 우선순위: P0
- 기준일: 2026-08-19
- 참고 OSS:
  [`Electron Security`](https://github.com/electron/electron/blob/main/docs/tutorial/security.md),
  [`Signal Desktop`](https://github.com/signalapp/Signal-Desktop)
- 영향 범위:
  [Electron main](../../apps/git-client/electron/main/index.ts),
  [window security](../../apps/git-client/electron/main/window-security.ts),
  [IPC security](../../apps/git-client/electron/main/ipc-security.ts),
  [preload](../../apps/git-client/electron/preload/index.ts),
  [Forge config](../../apps/git-client/forge.config.ts)

## 핵심 요약

- **현재 앱은 sandbox·context isolation·navigation 제한·기본 권한 거부·IPC sender 검증·Electron fuse를 이미 적용함**
- **개별 방어가 존재하는 것과 모든 진입 경로가 같은 정책을 따르는 것은 별도 검증 대상임**
- **Electron 공식 보안 권고를 항목별 source·test·package evidence에 연결하는 감사표가 필요함**
- **typed IPC는 입력 형태를 보호하지만 호출 권한과 repository capability까지 자동 보장하지 않음**
- **완료 기준은 설정 확인이 아니라 main window·child window·preload·protocol·외부 URL의 우회 실패를 증명하는 것임**

## 진행 현황

- **navigation과 IPC가 동일한 trusted renderer 판정을 사용하도록 통합함**
  - production은 `app://git-client`만 허용함
  - development는 설정된 Vite server origin만 허용함
  - 과거처럼 임의의 localhost port를 IPC origin으로 허용하지 않음
- **main window와 Local History route에 동일한 origin·route helper를 적용함**
  - main frame·window identity 검증은 기존대로 유지함
  - 잘못된 port와 route를 거부하는 unit test를 추가함
- **Electron 공식 권고와 현재 방어를 `apps/git-client/docs/electron-security-audit.md`에 연결함**
  - window preference·navigation·protocol·CSP·IPC·permission·certificate·fuse를 inventory함
  - 다른 window와 subframe sender 거부를 unit test로 고정함
  - authorization 생략 기본값을 제거해 새 procedure가 권한 결정을 생략할 수 없게 함
- **남은 범위는 production package에서 CSP와 QA 비활성화를 직접 확인하는 증거임**

## 현재 상태와 위험

- **BrowserWindow 기본 방어는 명시적으로 설정됨**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`를 사용함
  - main window와 Local History child window가 각각 제한된 preload를 사용함
- **navigation과 권한은 기본 거부 방식으로 구성됨**
  - 허용된 `app://git-client` 또는 개발 origin 이외의 navigation을 차단함
  - 새 창은 검증된 Local History URL만 허용함
  - Electron permission check와 request를 모두 기본 거부함
- **IPC에는 신뢰 sender와 repository capability 검증이 존재함**
  - main frame과 origin을 확인함
  - Git·terminal·Local History procedure가 허용된 repository ID를 사용하는지 확인함
- **정책이 여러 파일에 분산되어 새 창·procedure 추가 시 누락될 가능성이 있음**
  - 새 preload API가 최소 권한인지 한 곳에서 파악하기 어려움
  - 개발 origin 허용이 production package에 남지 않는지 package 수준 근거가 필요함

## 채택할 내용

- **Electron 공식 보안 체크리스트와 구현 대응표를 만듦**
  - BrowserWindow preference
  - CSP와 custom protocol
  - navigation·window open·external URL
  - permission·session·certificate
  - IPC sender·frame·origin·capability
  - Electron fuse와 ASAR integrity
- **모든 renderer 진입점을 동일한 감사 대상으로 포함함**
  - main window
  - Local History child window
  - QA fixture와 개발 server
  - 향후 추가되는 utility window
- **권한 검증의 fail-closed 성질을 자동화함**
  - 등록되지 않은 procedure 거부
  - 잘못된 repository ID 거부
  - subframe·다른 window·다른 origin 호출 거부
  - credential이 포함된 URL과 허용되지 않은 scheme 거부

## 채택하지 않을 내용

- **보안 확인을 TypeScript typecheck나 Zod parsing만으로 대체하지 않음**
- **개발 편의를 위해 `nodeIntegration`, broad permission 또는 임의 navigation을 허용하지 않음**
- **보안 library를 추가하는 것만으로 감사를 완료한 것으로 판단하지 않음**
- **Signal Desktop의 source나 암호화 구조를 라이선스 검토 없이 복사하지 않음**

## 실행 작업

- **공식 보안 권고별 구현·테스트·잔여 위험을 inventory함**
- **preload의 공개 method와 대응 main procedure·권한 검사를 대조함**
- **main window와 child window의 우회 시나리오를 unit·packaged test로 추가함**
- **production CSP와 protocol response가 실제 package에서 적용되는지 확인함**
- **새 Electron surface를 추가할 때 갱신해야 하는 최소 보안 검사 위치를 코드 계약으로 고정함**

## 완료 조건

- **공식 Electron 보안 권고마다 적용·해당 없음·보류 상태와 근거가 있음**
- **모든 preload API가 입력 schema와 main-side authorization을 가짐**
- **신뢰하지 않는 frame·window·origin·scheme의 호출과 navigation이 실패함**
- **production package에서 개발 origin과 QA 전용 권한이 활성화되지 않음**
- **Electron version 변경 시 감사 대상과 package 검증을 다시 실행할 수 있음**

## 검증

- **가까운 보안 테스트부터 실행함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run typecheck`
- **실제 package 경계를 확인함**
  - `pnpm --filter @jongminchung/git-client run test:electron`
  - 최종 `pnpm run check`
