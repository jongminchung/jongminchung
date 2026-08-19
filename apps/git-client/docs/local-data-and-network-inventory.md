# 로컬 데이터와 네트워크 inventory

- 기준일은 2026-08-19이며 Git Client가 생성하는 영속 데이터와 외부 연결의 owner·민감도·삭제 경계를 기록함
- 경로는 Electron의 `userData`를 기준으로 하며 OS와 실행 profile에 따라 절대 위치가 달라짐

## 핵심 요약

- **일반 설정과 암호화된 hosting credential은 `settings.json` 하나에 저장되지만 credential은 평문으로 기록되지 않음**
- **Local History·recovery·shelf·changelist는 Git utility가 별도 directory와 무결성 계약으로 관리함**
- **진단 로그는 credential을 redact하고 4MiB 단위로 한 번 회전함**
- **자동 telemetry·광고·background updater 연결은 현재 존재하지 않음**
- **network 연결은 사용자가 실행한 hosting 요청과 외부 URL 열기에 한정됨**

## 설정과 자격 증명

- **`settings.json`은 platform settings store가 소유함**
  - schema version은 2이며 atomic temporary write와 rename을 사용함
  - version 1은 원본 timestamp backup 뒤 유효한 값을 version 2로 보존함
  - future version과 손상 문서는 원본을 덮어쓰지 않고 실패함
  - settings export·import 대상이며 profile 삭제로 전체 제거할 수 있음
- **hosting credential은 credential store가 소유함**
  - 암호화 ciphertext만 `hostingCredential:*` key로 저장함
  - renderer와 settings archive에는 token 평문을 노출하지 않음
  - 계정 삭제 시 연결된 credential key를 함께 제거함

## Git 작업 데이터

- **Local History는 `local-history-v2` 아래 repository별 activity와 content object를 저장함**
  - repository file 내용이 포함될 수 있어 민감도가 높음
  - 기본 보존 기간은 5일이며 최대 activity 수는 20,000건임
  - 손상·legacy archive는 자동 덮어쓰기 대신 별도 archive directory로 격리됨
- **recovery는 `recovery` 아래 mutation 이전 snapshot을 저장함**
  - index와 working tree file 내용이 포함될 수 있어 민감도가 높음
  - repository별 최대 200개 entry로 제한함
  - 오래된 entry는 최대 개수 적용 시 제거되며 개별 삭제 surface는 현재 없음
- **shelf는 `shelves` 아래 patch와 필요한 file payload를 저장함**
  - working tree 내용이 포함될 수 있어 민감도가 높음
  - shelf 삭제 또는 profile 삭제까지 유지됨
- **changelist는 `changelists` 아래 이름과 repository 상대 path를 저장함**
  - file 내용이나 credential은 저장하지 않음
  - changelist 삭제 또는 profile 삭제까지 유지됨

## 진단·configuration·임시 데이터

- **`logs`는 diagnostics service와 Electron app log가 소유함**
  - URL credential, authorization과 token 형태를 redact함
  - 현재 log와 회전 log를 각각 최대 4MiB로 제한함
  - 사용자가 diagnostics 수집을 실행할 때만 archive 대상이 됨
- **`config`는 VM options와 custom properties를 저장함**
  - 사용자 입력 configuration이므로 export 전에 내용 검토가 필요함
  - diagnostics UI에서 읽기·수정·기본값 복원이 가능함
- **임시 write·export file은 원자적 교체 또는 작업 종료 시 정리함**
  - interrupted write에서 canonical file을 보존함
  - 외부로 저장한 HTML·patch·settings archive는 사용자가 선택한 위치와 OS 수명주기를 따름

## 네트워크 연결

- **GitHub·GitLab API 연결은 계정 연결 또는 사용자의 hosting 작업에서만 발생함**
  - 기본 background polling을 수행하지 않음
  - GitHub.com은 공식 API endpoint를 사용하고 GitLab은 계정 base URL의 API를 사용함
  - redirect는 credential 유출을 막기 위해 provider HTTP client에서 제한함
- **외부 URL 열기는 사용자가 명시적으로 선택한 hosting·도움말 action에서만 발생함**
  - HTTP·HTTPS 등 허용된 scheme과 credential 부재를 main process에서 확인함
- **자동 telemetry·crash upload·update check 연결은 없음**
  - 진단 자료는 로컬에서 생성되며 자동 업로드되지 않음
  - updater를 도입할 경우 endpoint·서명·기본 활성화·사용자 제어를 이 inventory에 먼저 추가해야 함

## 삭제·export 정책

- **개별 계정 credential은 계정 삭제로 제거함**
- **Local History는 5일 retention으로 정리되고 recovery는 repository별 200개를 넘는 오래된 entry가 정리됨**
- **shelf와 changelist는 각 제품 surface의 삭제 action으로 제거함**
- **settings archive는 일반 설정만 포함하며 credential과 Git 작업 payload를 포함하지 않음**
- **전체 데이터 삭제는 앱 종료 후 해당 OS profile의 `userData` directory 제거로 가능함**
