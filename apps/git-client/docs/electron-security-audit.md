# Electron 보안 감사표

- 기준일은 2026-08-19이며 Electron 공식 보안 권고를 현재 구현·자동 검증·잔여 위험에 연결함
- 새 window, preload API, protocol 또는 외부 연결을 추가할 때 이 문서와 관련 계약 테스트를 함께 갱신해야 함

## 핵심 요약

- **모든 renderer window는 sandbox·context isolation·web security를 사용하고 Node integration을 비활성화함**
- **production renderer는 `app://git-client`만 신뢰하며 개발 환경도 설정된 Vite origin 하나만 허용함**
- **preload API는 schema·procedure authorization·sender window 검증을 통과해야 main 기능을 호출할 수 있음**
- **권한 요청과 새 window는 기본 거부이며 Local History child window만 좁은 route 계약으로 허용함**
- **package는 ASAR integrity·fuse·codesign 검증을 거치며 production CSP는 package runtime에서 설치됨**

## Window와 renderer 격리

- **main window와 Local History window가 동일한 보안 preference를 사용함**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`를 사용함
  - main과 child가 서로 다른 최소 preload를 사용함
  - 근거는 `electron/main/index.ts`의 `createMainWindow`와 child override 설정임
- **navigation은 allowlist 밖의 URL을 실패 처리함**
  - production은 `app://git-client` origin만 허용함
  - development는 `MAIN_WINDOW_VITE_DEV_SERVER_URL`의 정확한 origin만 추가 허용함
  - credential 포함 URL, 유사 hostname, 다른 port와 허용되지 않은 route를 unit test로 거부함

## Protocol과 콘텐츠 정책

- **custom protocol은 renderer root 밖의 path를 읽을 수 없음**
  - encoded traversal과 renderer root 이탈을 `protocol-path` 계약에서 거부함
  - 알려지지 않은 확장자는 실행 가능한 MIME 대신 `application/octet-stream`으로 응답함
- **production package에 제한적인 CSP를 적용함**
  - script·font·connect source를 self로 제한함
  - object와 base URI를 차단하고 frame ancestor를 허용하지 않음
  - inline style은 현재 Tailwind·runtime style 요구 때문에 보류 예외로 유지함

## IPC와 preload 권한

- **모든 desktop tRPC procedure가 input·output schema와 명시적 authorization을 가짐**
  - authorization 생략 기본값을 제거해 새 procedure가 권한 결정을 생략하면 typecheck가 실패함
  - repository mutation·terminal·hosting은 active 또는 repository capability를 사용함
  - procedure registry와 router key의 고유성·schema 존재를 계약 테스트로 확인함
- **IPC sender는 window·main frame·origin을 모두 만족해야 함**
  - main window stream과 tRPC 호출은 등록된 window의 main frame만 허용함
  - Local History는 등록된 child window와 repository ID를 함께 확인함
  - 등록되지 않은 procedure, 잘못된 channel·operation type·protocol version을 거부함

## 권한·외부 URL·인증서

- **Electron session 권한은 check와 request 단계에서 모두 기본 거부함**
- **외부 URL은 schema와 main handler에서 허용 scheme·credential 부재를 확인함**
- **QA hosting 인증서 예외는 격리 profile과 명시적 argument가 함께 있을 때만 활성화됨**
  - loopback `127.0.0.1`과 기대 fingerprint가 모두 일치해야 함
  - 일반 production 실행에는 certificate verify override가 설치되지 않음

## Package 신뢰 경계

- **package는 위험한 Electron 실행 경로를 fuse로 차단함**
  - `RunAsNode`, Node option 환경 변수, CLI inspect와 file protocol 추가 권한을 비활성화함
  - ASAR integrity 검증과 ASAR 전용 app load를 활성화함
- **package 생성 후 서명·fuse·ASAR hash·native module을 검증함**
  - production release는 명시적 signing identity와 notarization profile 없이는 생성되지 않음
  - local package도 ad-hoc 서명 후 strict verification을 수행함

## 잔여 위험과 재검토 조건

- **`style-src 'unsafe-inline'` 제거는 runtime style 의존을 제거한 뒤 재검토가 필요함**
- **새 window·preload·protocol·permission handler 추가는 본 감사표와 우회 테스트 갱신이 필요함**
- **Electron major version 변경은 fuse·sandbox·CSP·certificate·navigation package 검증 재실행이 필요함**
