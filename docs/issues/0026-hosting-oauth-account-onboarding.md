# Issue 0026: Hosting 계정의 OAuth 기반 연결 도입

- 상태: 진행 중
- 상태 설명: provider별 코드·fixture 완료·외부 OAuth app 등록과 실계정 검증 진행 중
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
  [GitHub App refresh token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens),
  [GitHub App 권한표](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps),
  [GitLab OAuth API](https://docs.gitlab.com/api/oauth2/),
  [GitLab OAuth provider 설정](https://docs.gitlab.com/integration/oauth_provider/),
  [GitLab Self-Managed OAuth 설정](https://docs.gitlab.com/cli/authentication/)

## 핵심 요약

- **GitHub.com은 fine-grained repository 권한을 사용하는 GitHub App device flow를 구현함**
  - device code 발급과 device flow에서 발급된 token의 refresh에는 client secret이 필요하지 않음
- **GitLab.com과 GitLab Self-Managed는 public OAuth app의 authorization code + PKCE를 구현함**
  - GitLab Self-Managed는 instance별 client ID와 정확히 등록된 callback URL이 필요함
- **OAuth access token과 refresh token pair는 Electron main process가 OS Keychain으로 암호화해 관리함**
- **GitHub와 GitLab 모두 기존 PAT 연결을 fallback과 복구 경로로 유지함**
- **disconnect는 앱이 저장한 local Keychain credential을 제거하지만 provider의 원격 authorization revoke까지 보장하지 않음**
- **완료에는 외부 OAuth app 등록값과 GitHub.com·GitLab.com·GitLab Self-Managed 실계정 sandbox 검증이 필요함**

## 처리 결과

- **GitHub.com은 GitHub App + device flow 상태 머신과 refresh를 구현함**
  - client ID는 공개 설정으로 배포할 수 있음
  - client secret과 GitHub App private key는 생성 여부와 무관하게 desktop bundle에 포함하지 않음
  - 사용자가 `https://github.com/login/device`에서 code를 승인하므로 callback handler가 필요하지 않음
  - user access token expiration과 refresh token rotation을 유지함
- **GitLab.com과 GitLab Self-Managed는 public OAuth app + PKCE callback과 refresh를 구현함**
  - `state`와 S256 `code_challenge`를 사용하고 token 교환에 client secret을 포함하지 않음
  - callback은 app 등록값과 정확히 일치해야 하며 GitLab Self-Managed는 instance별 등록을 요구함
  - 전체 Hosting write 기능은 `api` scope가 필요하고 read-only 범위만 사용할 때는 `read_api`로 축소할 수 있음
- **실제 app 등록과 client ID 발급은 provider 설정 화면의 외부 운영 작업으로 남아 있음**
  - 현재 Hosting endpoint에 필요한 초기 repository permission matrix는 확정함
  - GitHub App의 client ID·app slug·소유 계정과 GitLab app의 client ID·callback URL·소유 계정을 공개 설정에 기록해야 함
- **provider 양쪽에서 PAT fallback을 유지함**
  - 연결 전에 provider별 최소 PAT 권한과 repository 제한·만료 설정을 안내함
- **Hosting API credential과 Git push credential이 별개임을 UI에 명시해 성공·실패 경계를 설명함**
- **disconnect는 local credential 삭제로 정의함**
  - access token과 refresh token pair를 Keychain에서 제거함
  - provider authorization과 이미 발급된 token의 원격 revoke는 보장하지 않으며 사용자의 provider 설정 화면에서 별도로 수행해야 함

## GitHub.com 구현 범위

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
- **device flow만 사용하므로 callback URL과 local callback listener가 필요하지 않음**
  - user code와 verification URL을 표시하고 provider가 반환한 polling interval을 준수함
  - `authorization_pending`·`slow_down`·사용자 취소·timeout을 구분함
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

## GitLab.com과 Self-Managed 구현 범위

- **GitLab.com은 배포 운영자가 public OAuth app을 등록함**
  - `Confidential`을 해제하고 authorization code grant를 사용함
  - client ID와 정확한 callback URL을 공개 설정에 기록함
  - client secret을 desktop package에 포함하지 않음
- **GitLab Self-Managed는 instance별 public OAuth app 등록을 요구함**
  - 지원 최소 버전과 callback URL·client ID·scope를 account 설정에 연결함
  - user-owned app 등록이 비활성화된 instance는 group-owned 또는 instance-wide app을 운영자가 제공해야 함
  - OAuth app을 제공하지 않는 instance는 PAT fallback만 지원함
- **browser authorization code flow에 PKCE를 필수 적용함**
  - cryptographically random `state`와 `code_verifier`를 생성하고 S256 `code_challenge`를 전송함
  - callback은 loopback listener에서 한 번만 처리하고 state mismatch·중복 callback·timeout을 거부함
  - access token과 회전된 refresh token을 원자적으로 Keychain에 교체함
- **현재 Hosting 전체 write capability에는 `api` scope가 필요함**
  - `write_repository`는 Git-over-HTTP용이며 merge request API write를 대신하지 않음
  - read-only prototype은 `read_api`로 축소할 수 있지만 write action을 제공하지 않음
- **GitLab device flow는 이번 구현 범위에 포함하지 않음**
  - GitLab.com과 Self-Managed 모두 browser PKCE를 기본으로 사용함
  - headless 환경은 이번 macOS-first desktop 범위가 아니며 PAT fallback으로 복구함

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
  - GitHub classic OAuth App은 이번 구현 범위에 포함하지 않음

## OSS 기준에서 확인한 인증 패턴

- **Git Credential Manager는 GitHub·GitLab을 포함한 provider 인증과 platform credential storage를 제공함**
  - desktop 환경에서는 interactive browser flow를 우선함
  - OAuth access token과 refresh token을 credential store에 저장할 수 있음
  - provider와 self-hosted host를 감지하고 인증 방식을 선택함
- **GitHub CLI는 browser flow를 기본으로 사용하고 token을 system credential store에 저장함**
- **채택할 핵심은 다른 도구의 secret을 직접 읽는 것이 아니라 사용자가 scope와 계정을 이해하고 승인하는 연결 흐름임**

## 현재 저장소의 공백

- **기본 cloud OAuth client ID와 provider app 운영 주체가 아직 원격 설정에 연결되지 않음**
  - 사용자가 client ID를 직접 입력하는 fixture 경로는 구현됐지만 일반 배포의 기본값은 외부 app 등록 뒤 확정해야 함
- **fixture로 검증한 token 수명주기를 실제 provider account에서 아직 검증하지 않음**
  - GitHub App 설치 범위와 GitLab `api` scope가 실제 Hosting action에 충분한지 sandbox 확인이 필요함
- **local disconnect는 구현됐지만 provider 원격 revoke는 secretless desktop 계약으로 제공되지 않음**
- **Git operation 인증과 Hosting API 인증이 서로 다른 credential을 사용할 수 있음**
  - push는 성공하지만 변경 요청 조회는 실패하거나 그 반대가 가능함
  - 사용자는 두 credential 경계를 구분하기 어려울 수 있음
- **GitHub Enterprise는 이번 OAuth 구현 범위에 포함되지 않으며 GitLab Self-Managed는 instance별 등록이 필요함**

## 구현 전제와 외부 의존성

- **GitHub.com GitHub App을 외부 Developer settings에서 등록해야 함**
  - client ID·app slug·소유 계정·repository permission·installation 정책을 확정함
- **GitLab.com public OAuth app을 등록하고 배포 callback URL을 확정해야 함**
  - client ID·소유 계정·scope와 callback 변경 절차를 기록함
- **GitLab Self-Managed는 지원 instance마다 public OAuth app이 필요함**
  - instance URL·client ID·callback URL·scope·최소 지원 버전을 명시함
- **client secret과 GitHub App private key를 desktop binary에 포함하지 않음**
- **privacy inventory와 network policy에 인증 endpoint·Keychain token pair·local disconnect 경계를 기록함**
- **실계정 sandbox는 fixture만으로 확인할 수 없는 provider 등록과 token 수명주기를 검증함**

## 채택할 내용

- **사용자가 선택 가능한 인증 경로를 제공함**
  - GitHub.com GitHub App device flow
  - GitLab.com·GitLab Self-Managed public OAuth app + PKCE
  - 양쪽 provider의 기존 PAT 연결
- **최소 권한과 기능별 capability를 연결함**
  - 필요한 scope와 이유를 인증 전에 표시함
  - 연결 뒤 사용할 수 없는 기능을 account capability로 표현함
  - 권한 확장이 필요하면 전체 token 교체가 아닌 재승인 흐름을 제공함
- **token 수명주기를 명시적으로 관리함**
  - refresh
  - local disconnect와 Keychain cleanup
  - expired와 permission-denied 구분
  - Keychain migration과 cleanup
- **remote revoke 한계를 사용자에게 명시함**
  - disconnect는 앱이 저장한 local access token과 refresh token만 제거함
  - provider authorization revoke는 provider 설정에서 사용자가 별도로 수행함
- **인증 실패 log와 진단 자료에서 credential을 계속 redaction함**

## 채택하지 않을 내용

- **설치된 `gh`, `glab` 또는 GCM의 token 파일과 Keychain entry를 몰래 읽지 않음**
- **OAuth client secret을 renderer 또는 배포 bundle의 비밀로 간주하지 않음**
- **self-hosted instance를 cloud endpoint로 자동 전송하지 않음**
- **PAT fallback을 제거하지 않음**
- **Git credential과 Hosting API credential이 항상 같다고 가정하지 않음**
- **local disconnect가 provider의 원격 token revoke까지 수행했다고 표시하지 않음**

## 실행 작업

- **확정한 GitHub App repository permission matrix를 연결 화면과 오류 계약에 반영함**
- **GitHub Developer settings에서 GitHub App을 생성하고 client ID·app slug를 기록함**
- **GitHub device flow polling·user code·refresh rotation과 fixture를 구현함**
- **GitLab.com OAuth app을 생성하고 client ID·callback URL을 기록함**
- **GitLab Self-Managed instance별 client ID 입력과 미등록 오류 경계를 구현함**
- **GitLab PKCE state·callback·refresh rotation과 fixture를 구현함**
- **Keychain access·token pair refresh·local disconnect·legacy PAT 호환 contract test를 추가함**
- **PAT와 OAuth account가 함께 존재할 때의 선택·표시·삭제 UX를 구현함**
- **GitHub.com·GitLab.com·GitLab Self-Managed 실계정 sandbox를 통과함**

## 완료 조건

- **GitHub.com·GitLab.com과 등록된 GitLab Self-Managed instance에서 PAT 복사 없이 계정을 연결할 수 있음**
- **사용자가 승인할 권한과 연결된 계정을 인증 전에 확인할 수 있음**
- **만료·회수·권한 부족이 서로 다른 복구 행동으로 안내됨**
- **disconnect 뒤 앱이 소유한 local access token과 refresh token이 Keychain에서 제거됨**
- **disconnect가 provider의 원격 authorization과 token revoke를 보장하지 않음이 UI와 문서에 명시됨**
- **GitHub App과 GitLab.com OAuth app의 외부 client ID, GitLab callback URL과 운영 소유자가 기록됨**
- **실계정 sandbox에서 GitHub device flow와 GitLab PKCE의 성공·refresh·권한 부족·disconnect가 검증됨**
- **GitHub Enterprise와 OAuth app 미등록 GitLab Self-Managed의 PAT-only 범위가 UI와 문서에 명시됨**

## 검증

- **실제 secret 없이 OAuth fixture와 GitLab local callback server를 검증함**
  - 성공과 사용자 취소
  - state mismatch와 redirect 위조
  - timeout과 재시도
  - refresh token rotation과 이전 token pair 폐기
  - Keychain write·read·delete 실패
- **실계정 sandbox에서 외부 등록 계약을 검증함**
  - GitHub.com GitHub App 설치·device flow·refresh·repository permission
  - GitLab.com public OAuth app·PKCE callback·refresh·scope
  - 지원 GitLab Self-Managed instance의 client ID·callback·API endpoint
  - local disconnect 뒤 Keychain 삭제와 provider 원격 authorization 잔존 안내
- **가까운 검증과 package 경계를 실행함**
  - `pnpm --filter @jongminchung/git-client run test`
  - Hosting integration test
  - packaged Hosting E2E
  - 최종 `pnpm run check`
