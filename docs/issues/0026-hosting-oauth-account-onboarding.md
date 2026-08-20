# Issue 0026: Hosting 계정의 OAuth 기반 연결 도입 검토

- 상태: 조건부 보류
- 상태 설명: GitHub 등록 가능·구현 조건 미충족
- 우선순위: P2
- 기준일: 2026-08-20
- 영향 범위:
  [HostingPanel](../../apps/git-client/src/components/HostingPanel.tsx),
  [HostingAccountConnection](../../apps/git-client/src/components/hosting/HostingAccountConnection.tsx),
  [Hosting bridge](../../apps/git-client/src/bridge/ElectronHostingBridge.ts),
  [Hosting service](../../apps/git-client/electron/hosting/hosting-service.ts),
  [local data와 privacy issue](archive/2026/0017-local-data-migration-and-privacy-inventory.md)
- 참고 OSS:
  [Git Credential Manager](https://github.com/git-ecosystem/git-credential-manager),
  [GCM generic OAuth](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/generic-oauth.md),
  [GitHub CLI `gh auth login`](https://cli.github.com/manual/gh_auth_login)
- 공식 기준:
  [GitHub OAuth App 생성](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app),
  [GitHub OAuth App 인증](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps),
  [GitHub OAuth App 보안 권고](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app),
  [GitHub App user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app),
  [GitHub App 권한표](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)

## 핵심 요약

- **현재 Hosting 연결은 사용자가 PAT를 직접 발급·복사하고 앱에 입력하는 방식임**
- **데스크톱 앱에 공개 도메인이 없어도 GitHub OAuth 등록과 인증이 가능함**
  - loopback callback은 `http://127.0.0.1` 주소와 실행 시 선택한 port를 사용할 수 있음
  - device flow는 callback URL과 client secret 없이 client ID만으로 진행할 수 있음
- **Keychain 저장은 안전한 보관을 제공하지만 token 생성 과정의 scope 선택·만료·회수 경험까지 해결하지 않음**
- **GitHub cloud의 우선 후보는 fine-grained repository 권한과 device flow를 결합한 GitHub App임**
  - classic OAuth App도 등록할 수 있지만 `repo` scope와 배포 bundle의 client secret 문제를 별도로 수용해야 함
- **등록 가능성과 별개로 권한·token 수명주기·운영 소유자를 확정한 뒤 구현해야 함**
- **기존 PAT 연결은 enterprise·self-hosted·복구 경로로 유지하고 OAuth를 유일한 인증 방식으로 강제하지 않음**

## 처리 결과

- **공개 도메인 부재는 GitHub cloud 등록의 차단 조건이 아님을 확인함**
  - browser authorization code flow는 `http://127.0.0.1/oauth/callback`을 등록하고 실행 시 임의의 loopback port를 선택할 수 있음
  - device flow는 사용자가 `https://github.com/login/device`에서 code를 승인하므로 callback handler가 필요하지 않음
- **GitHub App + device flow를 우선 등록안으로 선택함**
  - client ID는 공개 설정으로 배포할 수 있음
  - client secret과 GitHub App private key는 생성 여부와 무관하게 desktop bundle에 포함하지 않음
  - webhook server 없이 user access token만 사용하는 구성을 검토함
- **실제 GitHub App 등록과 client ID 발급은 GitHub Developer settings의 외부 운영 작업으로 남아 있음**
  - 현재 Hosting endpoint에 필요한 초기 repository permission matrix는 확정함
  - 등록 뒤 client ID·app slug·소유 계정·revocation 절차를 저장소의 공개 설정에 기록할 필요가 있음
- **현재 가능한 fallback으로 연결 전에 provider별 최소 PAT 권한과 repository 제한·만료 설정을 안내하도록 개선함**
- **Hosting API credential과 Git push credential이 별개임을 UI에 명시해 성공·실패 경계를 설명함**
- **cloud와 self-hosted server 모두 PAT fallback을 유지하고 browser sign-in의 운영 전제를 명시함**
- **OAuth App 운영 정책이 확정되면 state 검증·callback 위조·refresh·revoke fixture를 포함한 별도 구현이 필요함**

## GitHub cloud 등록 초안

- **등록 소유자는 현재 배포 주체인 `jongminchung`으로 지정함**
- **등록 유형은 GitHub App을 우선함**
  - GitHub App name은 `jongminchung-git-client`를 우선 사용함
  - 공개 배포를 위해 설치 대상은 `Any account`로 설정함
  - user access token용 device flow를 활성화함
  - user access token expiration과 refresh token rotation을 유지함
  - 설치 시 browser OAuth 요청은 활성화하지 않음
  - webhook은 server 수신 요구가 생길 때까지 비활성화함
  - private key를 desktop 인증에 사용하거나 package에 포함하지 않음
- **공개 제품 주소는 저장소의 Git Client 경로를 사용함**
  - Homepage URL: `https://github.com/jongminchung/jongminchung/tree/main/apps/git-client`
- **device flow만 사용할 때 callback URL은 인증 경로에 사용되지 않음**
  - 향후 browser authorization code + PKCE를 비교할 때 callback 기준값으로 `http://127.0.0.1/oauth/callback`을 사용함
  - runtime listener는 고정 port 대신 OS가 할당한 loopback port를 사용함
- **초기 repository 권한은 현재 Hosting endpoint inventory에서 도출한 최소값만 승인함**
  - `Metadata: read`는 GitHub App에 자동 부여됨
  - `Pull requests: read/write`는 PR 조회·파일·timeline·comment·review·update branch·viewed state에 사용됨
  - `Contents: read/write`는 fork sync에 사용됨
  - user permission과 organization permission은 요청하지 않음
- **`Administration: write`가 필요한 새 저장소 생성은 초기 OAuth capability에서 제외함**
  - `POST /user/repos` 하나를 위해 설치된 저장소 전체에 administration 권한을 요구하지 않음
  - 새 저장소 생성은 기존 PAT account 또는 별도 권한 확대를 선택한 account에만 제공함
- **등록 시 webhook과 event subscription을 모두 비활성화함**
  - 현재 구현은 polling과 사용자 action만 사용하므로 inbound server가 필요하지 않음

## classic OAuth App 대안

- **classic OAuth App도 소유 도메인 없이 등록할 수 있음**
  - Homepage URL에는 위 공개 Git Client 저장소 주소를 사용함
  - Authorization callback URL에는 `http://127.0.0.1/oauth/callback`을 사용함
- **authorization code + PKCE는 browser를 사용할 수 있는 native app의 우선 보안 패턴임**
  - GitHub OAuth App의 token 교환에는 client secret이 요구되므로 public client에서 secret을 기밀로 취급할 수 없음
  - PKCE와 `state`는 authorization code 탈취와 callback 위조 위험을 줄이지만 앱 사칭 가능성을 제거하지 않음
- **OAuth App device flow는 client secret과 redirect URI를 사용하지 않음**
  - CLI·headless 환경에는 적합하지만 원격 피싱에 악용될 수 있어 필요성이 명확할 때만 활성화함
- **classic OAuth App의 넓은 scope보다 GitHub App의 repository별 설치와 fine-grained permission을 우선함**
  - PAT보다 권한이 넓어지는 OAuth 전환은 사용자 경험 개선만으로 정당화하지 않음

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

- **GitHub cloud는 GitHub App + device flow를 우선 범위로 확정함**
- **GitLab cloud와 GitHub Enterprise·self-hosted GitLab의 후속 지원 범위를 별도로 확정함**
- **GitHub App의 client ID·permission·installation·revocation 정책을 결정함**
- **client secret을 desktop binary에 신뢰 가능한 비밀로 포함할 수 없다는 전제를 수용함**
- **GitHub 이외 provider의 loopback redirect와 device flow 지원 조합을 확인함**
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

- **확정한 GitHub App repository permission matrix를 등록 화면과 capability contract에 반영함**
- **GitHub Developer settings에서 등록 초안대로 GitHub App을 생성하고 client ID를 기록함**
- **device flow polling·user code·token 수명주기·revocation 위협 모델을 작성함**
- **GitLab cloud와 self-hosted 인증 capability matrix를 작성함**
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
