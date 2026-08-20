# Issue 0017: 로컬 데이터 migration과 privacy inventory 정리

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `7f4a72b`
- 우선순위: P2
- 기준일: 2026-08-19
- 참고 OSS:
  [`Joplin`](https://github.com/laurent22/joplin),
  [`Joplin Privacy Policy`](https://github.com/laurent22/joplin/blob/dev/readme/privacy.md),
  [`Signal Desktop`](https://github.com/signalapp/Signal-Desktop)
- 영향 범위:
  [settings store](../../../../apps/git-client/electron/main/settings-store.ts),
  [settings archive](../../../../apps/git-client/electron/main/settings-archive.ts),
  [credential store](../../../../apps/git-client/electron/main/hosting-credential-store.ts),
  [diagnostics](../../../../apps/git-client/electron/main/diagnostics-service.ts),
  [hosting HTTP](../../../../apps/git-client/electron/hosting/hosting-http.ts)

## 핵심 요약

- **현재 settings는 schema version, legacy backup, atomic write와 archive import·export를 지원함**
- **hosting credential은 safe storage 경계에 있고 diagnostics log도 별도 service로 관리됨**
- **v1 settings migration은 원본 backup과 JSON 값 검증 뒤 유효한 값을 v2에 보존하도록 개선됨**
- **설정·자격 증명·진단 로그·recovery data마다 보존 기간과 삭제·export 가능 여부가 필요함**
- **Joplin처럼 기능별 network connection과 기본 활성화 여부를 inventory하면 개인정보 경계를 검증할 수 있음**

## 진행 현황

- **유효한 v1 설정 값의 불필요한 초기화를 제거함**
  - legacy document를 먼저 schema와 JSON value로 검증함
  - 원본 timestamp backup을 만든 뒤 같은 값을 v2 document로 atomic write함
  - 지원하지 않는 미래 version은 기존대로 fail-closed 처리함
- **migration integration test가 backup과 값 보존을 함께 검증함**
- **전체 로컬 데이터와 network privacy inventory를 작성함**
  - settings·credential·Local History·recovery·shelf·changelist·diagnostics의 owner와 삭제 경계를 기록함
  - 5일 Local History retention, recovery 200건과 diagnostics log 4MiB 회전 기준을 연결함
  - hosting·외부 URL 연결과 telemetry·자동 upload·updater 부재를 사용자 관점에서 기록함
- **손상·미래 version·유효하지 않은 legacy 입력의 원본 보존을 integration test로 고정함**
  - 남은 temporary file을 자동 승격하지 않음
  - legacy `values` array를 유효한 settings document로 수용하지 않음

## 현재 상태와 위험

- **settings 저장은 손상 방지 장치를 포함함**
  - version 2 document를 schema로 검증함
  - 임시 파일을 sync한 뒤 rename함
  - write queue로 순서를 보장함
- **legacy settings는 검증·backup·migration 순서로 처리됨**
  - version 1 파일을 timestamp backup으로 복사함
  - 유효한 JSON 값은 새 version 2 settings에 유지함
  - 유효하지 않은 legacy 값은 원본을 덮어쓰지 않고 실패함
- **로컬 데이터의 전체 inventory는 여러 service에 분산됨**
  - 일반 settings
  - 암호화된 hosting credential
  - diagnostics와 crash 기록
  - local history·recovery snapshot·temporary file
  - repository metadata와 cache

## 채택할 내용

- **로컬 데이터 class별 수명주기 표를 작성함**
  - 위치와 owner
  - schema version
  - 민감도
  - backup·migration·rollback
  - export·delete
  - retention과 cleanup
- **migration을 단계별 함수와 fixture로 관리함**
  - 이전 version 입력
  - 예상 변환 결과
  - 원본 backup
  - 중간 실패와 재실행
  - 지원하지 않는 미래 version의 fail-closed 처리
- **network와 개인정보 inventory를 작성함**
  - hosting provider API
  - 외부 URL 열기
  - update와 release 확인
  - diagnostics·telemetry 여부
  - 각 연결의 기본 활성화와 사용자 제어

## 채택하지 않을 내용

- **모든 로컬 데이터를 settings JSON 하나로 통합하지 않음**
- **migration 실패 시 원본 파일을 덮어쓰거나 자동 삭제하지 않음**
- **diagnostics archive에 token·credential·repository secret을 포함하지 않음**
- **요구가 없는 telemetry를 OSS 사례만 보고 추가하지 않음**
- **Signal 또는 Joplin의 암호화 구현을 라이선스 검토 없이 복사하지 않음**

## 실행 작업

- **`userData` 아래 생성되는 파일과 directory를 runtime별로 inventory함**
- **v1에서 v2로 전환할 때 보존해야 할 값과 초기화할 값을 명시함**
- **migration fixture와 interrupted-write·corrupt-document test를 추가함**
- **settings archive와 credential store의 포함·제외 경계를 검증함**
- **diagnostics redaction과 network connection 목록을 사용자 관점에서 점검함**

## 완료 조건

- **모든 영속 데이터에 owner·version·민감도·삭제 정책이 있음**
- **지원되는 이전 version이 데이터 손실 없이 migration되거나 명시적 복구 경로를 제공함**
- **손상 파일과 미래 version이 원본을 보존한 채 안전하게 실패함**
- **export archive와 diagnostics에 credential이 포함되지 않음**
- **앱이 만드는 network connection과 기본 활성화 여부를 파악할 수 있음**

## 검증

- **데이터 경계와 실제 package upgrade를 확인함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run test:integration:native`
  - upgrade userData fixture를 사용한 `pnpm --filter @jongminchung/git-client run test:electron:prebuilt`
  - 최종 `pnpm run check`

## 구현 결과

- **`apps/git-client/docs/local-data-and-network-inventory.md`를 로컬 데이터·network 수명주기 기준으로 추가함**
- **settings archive는 credential key를 제외하고 diagnostics log는 credential 형태를 redact하는 기존 계약을 inventory에 연결함**
- **지원되는 legacy 값은 보존되고 지원할 수 없는 입력은 canonical file과 recovery artifact를 그대로 유지함**
