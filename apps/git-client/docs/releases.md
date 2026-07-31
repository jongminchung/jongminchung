# GitHub Release 배포 가이드

Git Client는 Electron 43.1.1로 만든 macOS ARM64 DMG를 GitHub Releases에서 직접 배포한다. 공개 artifact는 Developer ID Application으로 서명하고 Apple 공증 티켓을 포함한다. 인앱 자동 업데이트, updater feed, updater 서명 키, `latest.json`은 사용하지 않는다.

## 지원 범위

- macOS 26 이상
- Apple Silicon ARM64
- Developer ID 서명 및 Apple notarization을 통과한 production DMG

Intel Mac, Windows, Linux는 후속 범위다. ad-hoc 서명은 로컬 검증용으로만 허용하며 공개 Release에 업로드하지 않는다.

## 다운로드와 checksum 검증

1. [GitHub Releases](https://github.com/jongminchung/jongminchung/releases)에서 같은 버전의 파일 세 개를 내려받는다.
   - `Git-Client_<version>_macos_arm64.dmg`
   - `Git-Client_<version>_macos_arm64.dmg.sha256`
   - `Git-Client_<version>_macos_arm64.dmg.provenance.json`
2. 세 파일이 있는 디렉터리에서 provenance의 source SHA를 확인하고 SHA-256 manifest를 검증한다.

```sh
shasum -a 256 -c Git-Client_<version>_macos_arm64.dmg.sha256
```

출력에 `OK`가 표시된 DMG만 연다. checksum이 일치하지 않으면 파일을 실행하지 말고 다시 내려받는다. production 앱은 일반적인 Finder 설치 흐름에서 Gatekeeper를 통과해야 하며 **그래도 열기** 우회 절차를 배포 지침으로 사용하지 않는다.

## 릴리스 규칙

로컬 릴리스 명령은 Nx Release로 다음 버전과 릴리스 노트를 계산한다. 실제 GitHub 게시와 asset 업로드는 `gh` CLI가 담당한다.

| 항목          | 규칙                                                   |
| ------------- | ------------------------------------------------------ |
| 분석 범위     | `@jongminchung/git-client`의 Nx affected graph         |
| 릴리스 브랜치 | `main`                                                 |
| 태그          | `git-client-${version}`                                |
| 제목          | `Git Client <version>`                                 |
| 최초 버전     | `1.0.0`                                                |
| 게시 상태     | 검증된 draft를 Draft가 아닌 공개 Release로 전환        |
| 배포 파일     | ARM64 DMG, SHA-256 checksum, source provenance         |
| 미사용 기능   | npm publish, release commit, Nx Git tag, 자동 업데이트 |

`feat`는 minor, `fix`와 `perf`는 patch, `BREAKING CHANGE`는 major 버전을 만든다. `docs`, `test`, `chore`, `ci`, `refactor`만 있는 변경은 독립적으로 새 버전을 만들지 않는다. 커밋 scope가 아니라 실제 변경 파일과 Nx project graph를 기준으로 판정한다.

예시는 다음과 같다.

```text
feat(git-client): add commit search
fix(git-client): preserve selection after refresh
perf(git-client): reduce graph rendering work
```

Git Client가 의존하는 workspace package의 커밋은 dependency-aware renderer가 릴리스 노트에 포함한다. 다른 앱과 무관한 package의 커밋은 제외한다. root 파일이나 lockfile을 변경한 커밋은 `nx show projects --affected` 결과에서 Git Client가 실제로 영향받은 경우에만 포함한다. 이 과정에서 앱 전용 `git diff-tree`나 경로 파서를 사용하지 않는다.

Nx fixed group은 첫 changelog 기준을 저장소 최초 커밋으로 잡으므로 과거 다른 앱 변경이 섞일 수 있다. 이를 방지하기 위해 `1.0.0` 노트는 `Initial Git Client release.`로 고정하고 `1.0.0` 이후부터 Nx가 태그 사이의 프로젝트별 노트를 생성한다.

## 로컬 검증

일반 Electron package는 다음 명령으로 확인한다.

```sh
pnpm --filter @jongminchung/git-client electron:package
pnpm --filter @jongminchung/git-client electron:verify-package
pnpm --filter @jongminchung/git-client test:electron-package-policy
```

Developer ID가 없는 Apple Silicon Mac에서는 explicit local mode로 전체 source gate와 Forge make를 재현한다.

```sh
pnpm --filter @jongminchung/git-client release:validate-local -- 1.0.0
```

결과 이름에는 `_adhoc`가 들어간다. 예: `Git-Client_1.0.0_macos_arm64_adhoc.dmg`. 이 파일은 strict `codesign --verify --deep --strict`, Electron 43.1.1, ARM64, fuse, ASAR integrity, locale, node-pty와 크기 정책을 검증하지만 Apple notarization artifact가 아니므로 게시할 수 없다.

production 릴리스 staging은 signing identity와 `notarytool` keychain profile을 명시한다.

```sh
export GIT_CLIENT_CODESIGN_IDENTITY='Developer ID Application: Example Corp (TEAMID)'
export GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE='git-client-release'
pnpm --filter @jongminchung/git-client release:build -- 1.0.0
```

결과는 `apps/git-client/release-artifacts`에 만들어진다. 스크립트는 다음 순서를 강제한다.

1. stable SemVer, macOS ARM64, Developer ID identity와 notarization profile preflight
2. `origin/main`을 fetch한 뒤 clean worktree, `main` branch, `HEAD == origin/main` 확인
3. Vitest, TypeScript/Vite build, Electron package-policy test 후 source SHA 재확인
4. 깨끗한 `out`에서 Electron Forge make 후 source SHA 재확인
5. 단 하나의 app/DMG를 재귀적으로 발견하고 symlink output 거부
6. package verifier와 package policy, `codesign --verify --deep --strict`
7. Forge가 만든 바로 그 `.app`을 실행해 renderer/preload API handshake smoke 검증
8. Developer ID authority, Gatekeeper assessment, stapled notarization ticket
9. DMG 재마운트 후 같은 검증 반복
10. 앱 250MiB, DMG 160MiB 제한 및 SHA-256 manifest와 source provenance 생성

production에서 identity나 notarization 설정이 없으면 첫 source gate 전에 중단하며, 검증 실패 artifact를 GitHub에 올리지 않는다.

현재 태그와 Git 이력을 기준으로 버전과 노트만 확인할 때는 토큰이 필요 없다. Nx version 단계도 dry-run이므로 source manifest와 lockfile을 수정하지 않는다.

```sh
pnpm --filter @jongminchung/git-client release:dry-run
```

로컬에서 실제 게시 스크립트를 실행해야 한다면 repository contents 쓰기 권한이 있는 PAT를 현재 shell의 `GH_PAT`에 secret manager로 주입한다. 스크립트는 자식 `gh` 프로세스에만 `GH_TOKEN`으로 전달한다.

```sh
test -n "${GH_PAT:-}"
pnpm --filter @jongminchung/git-client release
```

## 게시 후 확인

- 태그가 `git-client-<version>`인지 확인한다.
- 제목이 `Git Client <version>`인지 확인한다.
- Release가 Draft가 아니며 DMG, checksum, source provenance를 모두 포함하는지 확인한다.
- 공개 Release에서 파일을 다시 내려받아 checksum 검증을 수행한다.
- 깨끗한 macOS 사용자 환경에서 DMG mount, Applications 복사와 정상 Gatekeeper 실행을 확인한다.
- 공개 asset 이름에 `_adhoc`가 없고 앱에 자동 업데이트 surface가 없는지 확인한다.
