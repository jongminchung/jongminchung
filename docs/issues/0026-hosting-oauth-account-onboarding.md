# Issue 0026: Hosting 계정의 OAuth 기반 연결 도입 검토

- 상태: 조건부 제안
- 우선순위: P2
- 기준일: 2026-08-19
- 영향 범위:
  [HostingPanel](../../apps/git-client/src/components/HostingPanel.tsx),
  [HostingAccountConnection](../../apps/git-client/src/components/hosting/HostingAccountConnection.tsx),
  [Hosting bridge](../../apps/git-client/src/bridge/ElectronHostingBridge.ts),
  [Hosting service](../../apps/git-client/electron/hosting/hosting-service.ts),
  [local data와 privacy issue](0017-local-data-migration-and-privacy-inventory.md)
- 참고 OSS:
  [Git Credential Manager](https://github.com/git-ecosystem/git-credential-manager),
  [GCM generic OAuth](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/generic-oauth.md),
  [GitHub CLI `gh auth login`](https://cli.github.com/manual/gh_auth_login)

## 핵심 요약

- **현재 Hosting 연결은 사용자가 PAT를 직접 발급·복사하고 앱에 입력하는 방식임**
- **Keychain 저장은 안전한 보관을 제공하지만 token 생성 과정의 scope 선택·만료·회수 경험까지 해결하지 않음**
- **OSS Git 도구는 browser 또는 device OAuth와 system credential store를 결합해 인증 진입 장벽을 줄임**
- **자체 OAuth client 운영 책임이 생기므로 배포 대상과 provider 정책이 확정되기 전에는 구현보다 feasibility 검증이 우선임**
- **기존 PAT 연결은 enterprise·self-hosted·복구 경로로 유지하고 OAuth를 유일한 인증 방식으로 강제하지 않음**

## OSS 기준에서 확인한 인증 패턴

- **Git Credential Manager는 GitHub·GitLab을 포함한 provider 인증과 platform credential storage를 제공함**
  - desktop 환경에서는 interactive browser flow를 우선함
  - OAuth access token과 refresh token을 credential store에 저장할 수 있음
  - provider와 self-hosted host를 감지하고 인증 방식을 선택함
- **GitHub CLI는 browser flow를 기본으로 사용하고 token을 system credential store에 저장함**
- **채택할 핵심은 다른 도구의 secret을 직접 읽는 것이 아니라 사용자가 scope와 계정을 이해하고 승인하는 연결 흐름임**

## 현재 저장소의 공백

- **사용자가 provider별 PAT 발급 화면과 필요한 scope를 스스로 알아야 함**
  - 너무 넓은 scope를 선택할 가능성이 있음
  - fine-grained token의 repository 제한으로 일부 기능만 실패할 수 있음
- **token 만료·회수·권한 부족의 재인증 경로가 account 연결과 분리되어 있지 않음**
- **Git operation 인증과 Hosting API 인증이 서로 다른 credential을 사용할 수 있음**
  - push는 성공하지만 변경 요청 조회는 실패하거나 그 반대가 가능함
  - 사용자는 두 credential 경계를 구분하기 어려울 수 있음
- **GitHub Enterprise와 self-hosted GitLab은 cloud provider와 OAuth 등록·endpoint 조건이 다름**

## 도입 전제

- **지원할 provider와 cloud·self-hosted 범위를 확정함**
- **OAuth App 또는 GitHub App의 client ID·redirect·scope·revocation 정책을 결정함**
- **client secret을 desktop binary에 신뢰 가능한 비밀로 포함할 수 없다는 전제를 수용함**
- **loopback redirect와 device flow 중 provider별 지원 조합을 확인함**
- **privacy inventory와 network policy에 인증 endpoint·token 수명주기를 기록함**

## 채택할 내용

- **사용자가 선택 가능한 인증 경로를 제공함**
  - browser 또는 device OAuth
  - 기존 PAT 연결
  - 설치된 credential helper 활용 여부 안내
- **최소 권한과 기능별 capability를 연결함**
  - 필요한 scope와 이유를 인증 전에 표시함
  - 연결 뒤 사용할 수 없는 기능을 account capability로 표현함
  - 권한 확장이 필요하면 전체 token 교체가 아닌 재승인 흐름을 제공함
- **token 수명주기를 명시적으로 관리함**
  - refresh
  - revoke와 disconnect
  - expired와 permission-denied 구분
  - Keychain migration과 cleanup
- **인증 실패 log와 진단 자료에서 credential을 계속 redaction함**

## 채택하지 않을 내용

- **설치된 `gh`, `glab` 또는 GCM의 token 파일과 Keychain entry를 몰래 읽지 않음**
- **OAuth client secret을 renderer 또는 배포 bundle의 비밀로 간주하지 않음**
- **self-hosted instance를 cloud endpoint로 자동 전송하지 않음**
- **PAT fallback을 제거하지 않음**
- **Git credential과 Hosting API credential이 항상 같다고 가정하지 않음**

## 실행 작업

- **GitHub·GitLab cloud와 self-hosted 인증 capability matrix를 작성함**
- **OAuth application 운영·redirect·scope·revocation 위협 모델을 작성함**
- **한 provider의 read-only capability로 feasibility prototype을 수행함**
- **Keychain access·refresh·disconnect·migration contract test를 추가함**
- **PAT와 OAuth account가 함께 존재할 때의 선택·표시·삭제 UX를 검증함**
- **도입 조건이 충족되지 않으면 scope 안내와 PAT 검증 오류 개선만 우선 적용함**

## 완료 조건

- **지원 provider에서 PAT 복사 없이 계정을 연결할 수 있음**
- **사용자가 승인할 권한과 연결된 계정을 인증 전에 확인할 수 있음**
- **만료·회수·권한 부족이 서로 다른 복구 행동으로 안내됨**
- **disconnect 뒤 앱 소유 credential과 refresh token이 제거됨**
- **enterprise·self-hosted 미지원 범위가 UI와 문서에 명시됨**

## 검증

- **실제 secret 없이 OAuth fixture와 local callback server를 검증함**
  - 성공과 사용자 취소
  - state mismatch와 redirect 위조
  - timeout과 재시도
  - refresh와 revoke
  - Keychain write·read·delete 실패
- **가까운 검증과 package 경계를 실행함**
  - `pnpm --filter @jongminchung/git-client run test`
  - Hosting integration test
  - packaged Hosting E2E
  - 최종 `pnpm run check`
