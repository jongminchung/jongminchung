# GitHub Release 배포 가이드

Git Client는 Electron 43.3.0으로 만든 macOS ARM64 DMG를 GitHub Releases에서 직접 배포한다. 공개 artifact는 Developer ID Application으로 서명하고 Apple 공증 티켓을 포함한다. 인앱 자동 업데이트, updater feed, updater 서명 키, `latest.json`은 사용하지 않는다.

## 지원 범위

- macOS 26 이상
- Apple Silicon ARM64
- Developer ID 서명 및 Apple notarization을 통과한 production DMG

Intel Mac, Windows, Linux는 후속 범위다. ad-hoc 서명은 로컬 검증용으로만 허용하며 공개 Release에 업로드하지 않는다.

## 다운로드와 checksum 검증

1. [GitHub Releases](https://github.com/jongminchung/jongminchung/releases)에서 다음 파일 세 개를 내려받는다.
   - `Git-Client_1.0.0_macos_arm64.dmg`
   - `Git-Client_1.0.0_macos_arm64.dmg.sha256`
   - `Git-Client_1.0.0_macos_arm64.dmg.provenance.json`
2. provenance의 source SHA를 확인하고 세 파일이 있는 디렉터리에서 SHA-256 manifest를 검증한다.

```sh
shasum -a 256 -c Git-Client_1.0.0_macos_arm64.dmg.sha256
```

출력에 `OK`가 표시된 DMG만 연다. checksum이 일치하지 않으면 파일을 실행하지 말고 다시 내려받는다. production 앱은 Finder의 일반 설치 흐름에서 Gatekeeper를 통과해야 하며 **그래도 열기** 우회 절차를 배포 지침으로 사용하지 않는다.

## 릴리스 규칙

GitHub Actions의 `Git Client` workflow는 `workflow_dispatch`로만 시작한다. 커밋 종류로 버전을 계산하지 않고 항상 기존 `1.0.0` 릴리스를 교체한다.
GitHub 인증은 `GH_PAT` Actions secret을 publisher의 동일한 환경 변수로 전달한다.

| 항목          | 규칙                                                       |
| ------------- | ---------------------------------------------------------- |
| 실행 방식     | GitHub Actions에서 수동 실행                               |
| 릴리스 브랜치 | `main`                                                     |
| 태그          | `git-client-1.0.0`                                         |
| 제목          | `Git Client 1.0.0`                                         |
| 게시 상태     | 검증된 draft를 Draft가 아닌 공개 Release로 전환            |
| 배포 파일     | ARM64 DMG, SHA-256 checksum, source provenance             |
| 미사용 기능   | npm publish, release commit, 자동 버전 산정, 자동 업데이트 |

publisher는 새 production artifact를 먼저 만든 뒤 기존 `git-client-1.0.0` Release와 태그를 삭제한다. 새 draft의 태그, 제목, asset 목록을 검증한 다음 공개 상태로 전환한다. 실패한 현재 실행이 만든 draft와 태그만 정리하며 검증 실패 artifact는 게시하지 않는다.

## 로컬 검증

일반 Electron package는 다음 명령으로 확인한다.

```sh
pnpm --filter @jongminchung/git-client electron:package
pnpm --filter @jongminchung/git-client electron:verify-package
pnpm --filter @jongminchung/git-client test:electron-package-policy
```

Developer ID가 없는 Apple Silicon Mac에서는 explicit local mode로 전체 source gate와 Forge package를 재현한다.

```sh
pnpm --filter @jongminchung/git-client release:validate-local -- 1.0.0
```

결과 이름에는 `_adhoc`가 들어간다. 예: `Git-Client_1.0.0_macos_arm64_adhoc.dmg`. 이 파일은 strict `codesign --verify --deep --strict`, Electron 43.3.0, ARM64, fuse, ASAR integrity, locale, node-pty와 크기 정책을 검증하지만 Apple notarization artifact가 아니므로 게시할 수 없다.

production 릴리스 staging은 signing identity와 `notarytool` keychain profile을 명시한다.

```sh
export GIT_CLIENT_CODESIGN_IDENTITY='Developer ID Application: Example Corp (TEAMID)'
export GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE='git-client-release'
pnpm --filter @jongminchung/git-client release:build -- 1.0.0
```

결과는 `apps/git-client/release-artifacts`에 만들어진다. 스크립트는 다음 순서를 강제한다.

1. 고정 버전, macOS ARM64, Developer ID identity와 notarization profile preflight
2. `origin/main`을 fetch한 뒤 clean worktree, `main` branch, `HEAD == origin/main` 확인
3. 공용 tooling을 bootstrap한 뒤 Vitest, TypeScript/Vite build, Electron package-policy test 후 source SHA 재확인
4. 깨끗한 `out`에서 Electron Forge package 후 source SHA 재확인
5. 단 하나의 app을 재귀적으로 발견하고 symlink 및 중간 DMG output 거부
6. package verifier와 package policy, `codesign --verify --deep --strict`
7. Forge가 만든 바로 그 `.app`을 실행해 renderer/preload API handshake smoke 검증
8. Developer ID authority, Gatekeeper assessment, stapled notarization ticket
9. 검증된 `.app`으로 재현 가능한 DMG를 생성하고 재마운트 후 같은 검증 반복
10. 앱 250MiB, DMG 160MiB 제한 및 SHA-256 manifest와 source provenance 생성

production에서 identity나 notarization 설정이 없으면 첫 source gate 전에 중단한다.

고정 버전과 릴리스 노트만 확인할 때는 토큰이 필요 없다.

```sh
pnpm --filter @jongminchung/git-client release:dry-run
```

로컬에서 실제 게시 스크립트를 실행해야 한다면 repository contents 쓰기 권한이 있는 PAT를 현재 shell의 `GH_PAT`에 secret manager로 주입한다. 스크립트는 자식 `gh` 프로세스에만 `GH_TOKEN`으로 전달한다.

```sh
test -n "${GH_PAT:-}"
pnpm --filter @jongminchung/git-client release
```

## 게시 후 확인

- 태그가 `git-client-1.0.0`인지 확인한다.
- 제목이 `Git Client 1.0.0`인지 확인한다.
- Release가 Draft가 아니며 DMG, checksum, source provenance를 모두 포함하는지 확인한다.
- 공개 Release에서 파일을 다시 내려받아 checksum 검증을 수행한다.
- 깨끗한 macOS 사용자 환경에서 DMG mount, Applications 복사와 정상 Gatekeeper 실행을 확인한다.
- 공개 asset 이름에 `_adhoc`가 없고 앱에 자동 업데이트 surface가 없는지 확인한다.
