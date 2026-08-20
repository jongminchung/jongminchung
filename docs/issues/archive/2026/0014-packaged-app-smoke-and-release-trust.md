# Issue 0014: 패키징된 Electron 앱의 smoke test와 릴리스 신뢰성 보강

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `a9f5b6c`
- 우선순위: P1
- 기준일: 2026-08-19
- 참고 OSS:
  [`GitHub Desktop packaging`](https://github.com/desktop/desktop/blob/development/docs/technical/packaging.md),
  [`VS Code smoke test`](https://github.com/microsoft/vscode/blob/main/test/smoke/README.md),
  [`Signal reproducible builds`](https://github.com/signalapp/Signal-Desktop/tree/main/reproducible-builds)
- 영향 범위:
  [Forge config](../../../../apps/git-client/forge.config.ts),
  [package verifier](../../../../apps/git-client/scripts/verify-electron-package.ts),
  [package smoke](../../../../apps/git-client/scripts/smoke-electron-package.ts),
  [packaged Playwright](../../../../apps/git-client/playwright.electron.config.ts),
  [release scripts](../../../../apps/git-client/scripts)

## 핵심 요약

- **현재 앱은 package 생성·fuse·ASAR integrity·codesign·native module·size·smoke·packaged Playwright를 이미 검증함**
- **기존 검증을 실제 배포 artifact와 clean profile의 핵심 사용자 여정에 연결하는 것이 다음 과제임**
- **개발 server E2E와 package E2E의 책임을 구분해 동일 테스트의 비용 높은 중복을 피해야 함**
- **재현성은 DMG byte 비교뿐 아니라 입력 version·architecture·package content와 evidence provenance를 포함해야 함**
- **릴리스 workflow drift는 Issue 0006과 연결하고 이 이슈에서는 Electron artifact의 신뢰성만 다룸**

## 현재 상태와 위험

- **package verifier의 기반은 강하게 구성됨**
  - bundle ID·Electron version·architecture를 확인함
  - Electron fuse와 ASAR SHA-256 metadata를 확인함
  - `node-pty` binary와 helper 권한을 확인함
  - codesign과 package size를 확인함
- **실제 package 사용자 여정도 별도 Playwright 구성으로 실행됨**
  - package 경로를 명시적으로 찾음
  - Git 상태 oracle과 독립 audit fixture가 존재함
- **검증 결과가 어떤 release artifact에서 생성되었는지 연결하는 근거는 강화할 수 있음**
  - app·DMG·checksum·test evidence 사이 digest 연결이 필요함
  - 깨끗한 userData에서 첫 실행과 재실행 결과를 구분할 필요가 있음
  - production signing·notarization은 로컬 ad-hoc 결과와 분리해야 함

## 채택할 내용

- **package test를 세 계층으로 분리함**
  - 정적 artifact 검사
  - process startup과 shutdown smoke
  - 핵심 사용자 여정의 packaged Playwright
- **최소 packaged journey를 안정적으로 유지함**
  - clean profile 첫 실행
  - 기존 repository 열기와 상태 확인
  - 대표 read·write Git 작업
  - terminal utility 시작과 종료
  - 앱 종료 후 child process 정리
- **release evidence에 provenance를 연결함**
  - 입력 version과 commit
  - architecture와 Electron version
  - app·DMG digest
  - signing·notarization 결과
  - 실행한 검증과 결과

## 채택하지 않을 내용

- **모든 renderer E2E를 package 환경에서 다시 실행하지 않음**
- **ad-hoc signing 통과를 production notarization 성공으로 간주하지 않음**
- **Issue 0006의 package publish workflow 계약을 중복 구현하지 않음**
- **Issue 0008의 frontend asset budget을 전체 Electron app 크기와 혼합하지 않음**

## 실행 작업

- **현재 package·release 검사를 static·smoke·journey·production-only로 분류함**
- **clean userData와 upgrade userData fixture를 분리함**
- **artifact digest와 test evidence manifest를 연결함**
- **production release에서 signing·notarization·stapling 결과를 독립적으로 검증함**
- **동일한 package를 대상으로 smoke와 Playwright가 실행되도록 경로 계약을 고정함**

## 완료 조건

- **검증된 app과 배포 DMG가 digest로 연결됨**
- **clean profile에서 package가 시작되고 핵심 Git 여정을 완료한 뒤 정상 종료됨**
- **native module·fuse·ASAR·codesign 회귀가 배포 전에 차단됨**
- **production artifact는 notarization 결과를 증명하고 ad-hoc artifact와 구분됨**
- **실패 evidence만으로 어느 계층에서 문제가 발생했는지 판별할 수 있음**

## 검증

- **기존 Electron package 계약을 실행함**
  - `pnpm --filter @jongminchung/git-client run test:integration:native`
  - `pnpm --filter @jongminchung/git-client run test:electron`
  - `pnpm --filter @jongminchung/git-client run release:validate-local -- 1.0.0`
  - 최종 `pnpm run check`

## 처리 결과

- **release provenance schema를 v2로 올리고 실제 검증 결과를 DMG digest와 연결함**
  - package verifier의 bundle ID·architecture·Electron version·ASAR digest·codesign 결과를 기록함
  - 동일한 Forge app에 실행한 startup smoke 결과를 기록함
  - production에서 Developer ID·Gatekeeper·stapled notarization 검증이 모두 끝난 경우에만 production evidence를 기록함
- **package 검증 계층을 기존 명령 경계에 유지함**
  - 정적 검사는 `electron:verify-package`, startup은 `electron:smoke-package`, 핵심 여정은 packaged Playwright가 담당함
  - production 전용 검증은 `release:build`가 담당하므로 ad-hoc 결과와 혼합되지 않음
