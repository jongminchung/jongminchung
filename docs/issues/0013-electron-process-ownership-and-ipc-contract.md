# Issue 0013: Electron 프로세스 소유권과 IPC 계약 정리

- 상태: 완료
- 우선순위: P1
- 기준일: 2026-08-19
- 참고 OSS:
  [`VS Code Source Code Organization`](https://github.com/microsoft/vscode/wiki/Source-Code-Organization/e7745b74f35efcff8a6a34780d21e0acb4528b53),
  [`Insomnia Development`](https://github.com/Kong/insomnia/blob/develop/DEVELOPMENT.md)
- 영향 범위:
  [Electron main](../../apps/git-client/electron/main),
  [preload](../../apps/git-client/electron/preload),
  [shared contracts](../../apps/git-client/src/shared/contracts),
  [renderer bridges](../../apps/git-client/src/bridge),
  [utility processes](../../apps/git-client/electron/utility)

## 핵심 요약

- **현재 앱은 main·preload·renderer·Git utility·terminal utility를 분리하고 typed tRPC와 protocol version을 사용함**
- **다음 단계는 폴더 구분을 실제 import 방향·소유권·오류·취소 계약으로 고정하는 것임**
- **renderer가 Electron 세부사항을 모르고 main이 UI 상태를 소유하지 않는 구조를 유지해야 함**
- **새 procedure가 입력 schema만 추가하고 authorization·timeout·dispose 처리를 빠뜨리는 회귀를 차단해야 함**
- **VS Code의 실행 환경 계층은 원칙만 채택하고 대규모 DI framework는 도입하지 않음**

## 진행 현황

- **Electron main의 renderer domain 의존을 제거함**
  - Safe Mode의 공통 access type과 오류를 `shared/contracts`가 소유함
  - renderer domain은 기존 import 호환성을 위해 공통 contract를 다시 export함
  - Electron main은 renderer state 구현을 더 이상 import하지 않음
- **Electron production module의 import 방향을 자동 검증함**
  - `electron/**`에서 `src/**`로 들어가는 import는 `shared/contracts`로 제한함
  - native menu 생성에 필요한 canonical command manifest만 명시적으로 허용함
  - renderer component·feature·domain으로 향하는 새 import를 실패 처리함
- **procedure 등록과 authorization의 완전성을 보강함**
  - `query`와 `mutation`의 trusted authorization 기본값을 제거함
  - 모든 procedure가 trusted·active capability·repository capability 중 하나를 명시함
  - 새 procedure가 authorization 없이 추가되면 typecheck가 실패함
- **장기 실행 request의 취소·dispose·utility crash와 native 오류 직렬화 계약을 보강함**
  - packaged E2E가 실제 hanging Git HTTP query의 cancel·terminal event·repository 불변 상태를 검증함
  - Git·terminal utility client가 dispose 응답 뒤 pending request를 거부하고 process를 한 번만 종료함
  - utility crash는 pending request와 listener를 정리하고 안정적인 transport code로 전달함
  - renderer에는 명시적인 native `code`·`message`·`field`만 전달하고 native stack·cause를 제거함

## 현재 상태와 위험

- **shared contract와 adapter가 이미 존재함**
  - renderer는 `DesktopPort`와 bridge를 통해 native 기능을 사용함
  - preload는 schema parsing 뒤 desktop tRPC를 호출함
  - Git과 terminal은 별도 utility process에서 실행됨
- **utility protocol은 handshake와 version 검증을 포함함**
  - process crash와 dispose 상태도 명시적으로 다룸
  - repository capability가 procedure별로 계산됨
- **계약 추가 과정은 여러 계층의 동시 변경을 요구함**
  - shared schema
  - preload API
  - tRPC router와 authorization
  - main handler
  - renderer adapter
  - utility transport 또는 service
- **누락 방지는 현재 개별 테스트와 리뷰에 의존하는 부분이 있음**
  - procedure 전체 목록과 authorization 목록의 완전성 비교가 필요함
  - runtime 전용 module의 역방향 import를 지속적으로 차단해야 함

## 채택할 내용

- **실행 환경별 소유권을 명시함**
  - shared는 직렬화 가능한 type·schema·순수 domain contract만 소유함
  - renderer는 화면 상태와 사용자 interaction을 소유함
  - preload는 최소 bridge와 runtime validation만 소유함
  - main은 window·OS API·권한과 process orchestration을 소유함
  - utility는 Git·PTY처럼 격리가 필요한 장기 실행 자원을 소유함
- **IPC procedure의 공통 계약을 정의함**
  - request와 response schema
  - authorization과 repository capability
  - error code와 사용자 노출 가능 message
  - timeout·cancel·dispose
  - protocol version compatibility
- **정적 경계 검사와 계약 테스트를 함께 사용함**
  - renderer에서 Electron·Node main module import 금지
  - shared에서 DOM·Electron·Node side effect import 금지
  - main에서 React와 renderer feature import 금지
  - 등록된 procedure와 authorization coverage의 완전성 확인

## 채택하지 않을 내용

- **폴더 이름 변경이나 대규모 파일 이동만으로 경계 정리를 완료하지 않음**
- **모든 service를 하나의 global container나 framework DI로 통합하지 않음**
- **main과 renderer가 같은 mutable state를 각각 canonical source로 보유하지 않음**
- **공용 UI 공개 계약을 이 이슈의 범위에 포함하지 않음**

## 실행 작업

- **현재 module을 runtime과 소유 domain 기준으로 inventory함**
- **이미 존재하는 renderer boundary test를 main·preload·shared·utility까지 확장함**
- **procedure 등록과 authorization switch의 완전성 테스트를 추가함**
- **native error가 process 경계를 지나며 보존해야 할 field와 제거해야 할 detail을 정의함**
- **장기 실행 request의 cancellation과 process dispose 순서를 대표 contract test로 고정함**

## 완료 조건

- **각 module의 실행 runtime과 owner를 경로 또는 좁은 규칙으로 판별할 수 있음**
- **금지된 역방향 import가 CI 전에 검출됨**
- **새 procedure가 authorization 없이 등록될 수 없음**
- **오류·취소·utility crash가 renderer에 안정적인 contract로 전달됨**
- **기존 public UI export나 component 계약을 변경하지 않음**

## 구현 결과

- **`NativeError`의 process 경계 계약을 명시함**
  - 예상된 native 오류의 공개 가능한 field만 cause chain에서 식별함
  - settings read 실패는 실제 file path 대신 안정적인 사용자 메시지를 사용함
- **desktop tRPC wire error에 nullable `field`를 추가함**
  - protocol parser가 이전 field 없는 응답도 `null`로 정규화함
  - preload client는 `code`와 `field`를 error metadata로 전달함
- **오류 payload에 stack과 원래 내부 값이 포함되지 않는 contract test를 추가함**

## 검증

- **경계와 계약 테스트를 실행함**
  - `pnpm --filter @jongminchung/git-client run typecheck`
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run test:integration:native`
  - 최종 `pnpm run check`
