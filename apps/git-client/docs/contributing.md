# Git Client 로컬 개발·테스트 가이드

이 문서는 Git Client를 로컬에서 실행하고 변경 영역에 맞는 테스트를 선택하는 방법을 설명한다. 별도 안내가 없으면 모든 명령은 모노레포 루트에서 실행한다.

## 지원 환경

- macOS ARM64
- Node.js 26.5.0 (`.node-version`)
- pnpm 11.15.1 (`package.json#packageManager`)
- 시스템 Git 2.39 이상

버전과 의존성을 확인한다.

```sh
node --version
pnpm --version
git --version
pnpm install --frozen-lockfile
pnpm --filter @jongminchung/git-client exec playwright install chromium
```

의존성은 항상 모노레포 루트에서 설치한다. `apps/git-client`만 별도로 설치하면 workspace package와 공용 Vitest 설정을 찾지 못할 수 있다.

## 애플리케이션 구조

- `src/`: React renderer, 화면 상태, command registry, preload와 공유하는 계약
- `electron/main/`: 창, native menu, settings, Git·Terminal·hosting IPC 경계
- `electron/preload/`: context-isolated `window.gitClient` bridge
- `electron/utility/`: allowlist 기반 Git 실행과 repository service
- `tests/`: 브라우저 QA fixture를 사용하는 renderer Playwright 테스트
- `electron-tests/`: 패키지 앱을 visible UI로 조작하는 직렬 Electron 테스트
- `scripts/independent-audit/`: disposable Git fixture와 상태 oracle

Renderer가 임의 Git 명령이나 Node.js API를 직접 받지 않도록 한다. 외부 입력은 `src/shared/contracts`의 Zod schema에서 검증하고, renderer·preload·main·utility 타입을 함께 변경한다.

## Electron 개발 모드

실제 폴더 선택기, Git bridge, 설정 복원과 PTY를 확인하려면 Electron Forge 개발 모드를 실행한다.

```sh
pnpm --filter @jongminchung/git-client run dev
```

- React·CSS 변경은 renderer HMR로 반영된다.
- main·preload·utility 변경은 재빌드 후 앱을 다시 시작해야 한다.
- Web Inspector는 앱에서 `⌘⌥I`로 연다.
- main·utility 로그는 명령을 실행한 터미널에서 확인한다.
- 개발 세션은 `Ctrl+C`로 종료한다.

Vite는 `127.0.0.1:1420`을 사용한다. 시작에 실패하면 기존 listener를 확인한다.

```sh
lsof -nP -iTCP:1420 -sTCP:LISTEN
```

## 브라우저 QA fixture

레이아웃, diff, 메뉴와 키보드 흐름만 빠르게 확인할 때 Vite를 직접 실행한다.

```sh
pnpm --filter @jongminchung/git-client exec vite --host 127.0.0.1
```

브라우저에서 다음 주소를 연다.

```text
http://127.0.0.1:1420/?fixture=qa
```

QA fixture는 결정적인 mock repository만 제공한다. native picker, 실제 Git 부작용, preload IPC와 PTY 검증에는 사용하지 않는다. 해당 기능은 Electron 개발 모드나 패키지 E2E에서 확인한다.

## 안전한 Git fixture

mutation 기능을 개인 작업 저장소에서 시험하지 않는다. 임시 저장소를 만든 뒤 앱의 **Open Repository**로 연다.

```sh
FIXTURE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/git-client-dev.XXXXXX")"
git -C "$FIXTURE_ROOT" init -b main
git -C "$FIXTURE_ROOT" config user.name "Git Client Dev"
git -C "$FIXTURE_ROOT" config user.email "git-client-dev@example.com"
printf 'fixture\n' > "$FIXTURE_ROOT/fixture.txt"
git -C "$FIXTURE_ROOT" add fixture.txt
git -C "$FIXTURE_ROOT" commit -m "chore: initialize fixture"
printf '%s\n' "$FIXTURE_ROOT"
```

rebase, abort, stash와 remote refs를 비교해야 하면 독립 fixture와 oracle을 사용한다.

```sh
AUDIT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/git-client-audit.XXXXXX")"
node apps/git-client/scripts/independent-audit/create-fixture.ts \
  --root "$AUDIT_ROOT/fixture"

node apps/git-client/scripts/independent-audit/git-state-oracle.ts snapshot \
  "$AUDIT_ROOT/fixture/git-client-case"
```

oracle은 `HEAD`, refs, porcelain v2 status, index/working diff, stash와 remote refs를 직렬화한다. 테스트가 끝난 뒤 출력 경로를 확인하고 임시 디렉터리를 정리한다.

## 빠른 개발 테스트

변경 중 기본 루프는 typecheck, 단위 테스트와 renderer 테스트다.

```sh
pnpm --filter @jongminchung/git-client qa:compact
```

개별 명령은 다음과 같다.

| 명령                                                                 | 검증 범위                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| `pnpm --filter @jongminchung/git-client run typecheck`               | renderer TypeScript                                   |
| `pnpm --filter @jongminchung/git-client run test`                    | Vitest 단위·통합 테스트                               |
| `pnpm --filter @jongminchung/git-client run test:e2e`                | Vite QA fixture 기반 renderer Playwright              |
| `pnpm --filter @jongminchung/git-client run build`                   | renderer와 Electron TypeScript, Vite production build |
| `pnpm --filter @jongminchung/git-client run test:integration:native` | Integration의 독립 audit·package policy Node 검사     |

실패 상세가 필요할 때만 verbose reporter를 사용한다.

```sh
pnpm --filter @jongminchung/git-client run test:verbose
GIT_CLIENT_VERBOSE_TESTS=1 pnpm --filter @jongminchung/git-client run test:e2e
```

결과와 trace는 다음 경로에 기록된다.

- `apps/git-client/test-results/qa/renderer.json`
- `apps/git-client/test-results/renderer-artifacts/`

## 선택 테스트 실행

Vitest 파일 하나만 실행한다.

```sh
pnpm exec vitest run apps/git-client/src/domain/repositoryAccess.test.ts
```

Renderer Playwright 시나리오를 선택한다.

```sh
pnpm --filter @jongminchung/git-client exec playwright test \
  tests/app.spec.ts --grep "Welcome"
```

의도적인 시각 변경만 snapshot을 갱신하고 생성된 diff를 직접 검토한다.

```sh
pnpm --filter @jongminchung/git-client run test:e2e:update
```

## 패키지 Electron 검증

main, preload, utility, native menu, Git 부작용, Terminal 또는 Safe Mode를 변경하면 패키지 앱을 다시 만든 뒤 Electron 테스트를 직렬 실행한다.

```sh
pnpm --filter @jongminchung/git-client electron:package
pnpm --filter @jongminchung/git-client electron:verify-package
pnpm --filter @jongminchung/git-client electron:smoke-package
pnpm --filter @jongminchung/git-client run test:electron
```

- 패키지 위치: `apps/git-client/out/Git Client-darwin-arm64/Git Client.app`
- smoke 성공 조건: `ready=true`, `preloadApi=true`, exit 0
- Electron Playwright는 동일 bundle identifier의 single-instance lock 때문에 `workers: 1`로 실행한다.
- 테스트는 격리된 QA profile과 disposable repository를 사용한다.
- 결과: `apps/git-client/test-results/qa/electron.json`
- artifacts: `apps/git-client/test-results/electron-artifacts/`

Electron 시나리오 하나만 실행할 때도 패키징을 먼저 수행한다.

```sh
pnpm --filter @jongminchung/git-client exec playwright test \
  --config playwright.electron.config.ts \
  electron-tests/safe-mode-ui.spec.ts
```

패키지 테스트를 병렬로 실행하지 않는다. 실행 중 남은 Git Client 프로세스가 있으면 종료한 뒤 다시 시도한다.

## 변경 유형별 필수 검증

| 변경 유형                  | 최소 검증                                                             |
| -------------------------- | --------------------------------------------------------------------- |
| React·CSS·키보드           | `typecheck`, 관련 Vitest, `test:e2e`                                  |
| Git operation·상태 전이    | 관련 Vitest, oracle, 패키지 Electron 시나리오                         |
| main·preload·utility·IPC   | `build`, package verify/smoke, `test:electron`                        |
| Safe Mode·Terminal·hosting | main fail-closed 단위 테스트와 직접 bridge 우회 E2E                   |
| command·단축키             | `command-manifest.json`, native menu, palette, disabled reason 테스트 |
| snapshot·geometry          | 800×650, 1184×768, 1584×918 대상 assertion과 screenshot 검토          |
| release·DMG                | [GitHub Release 배포 가이드](releases.md)의 로컬 검증                 |

## 전체 제출 전 게이트

```sh
pnpm --filter @jongminchung/git-client run typecheck
pnpm --filter @jongminchung/git-client run test
pnpm --filter @jongminchung/git-client run test:e2e
pnpm --filter @jongminchung/git-client run test:integration:native
pnpm --filter @jongminchung/git-client electron:package
pnpm --filter @jongminchung/git-client electron:verify-package
pnpm --filter @jongminchung/git-client electron:smoke-package
pnpm --filter @jongminchung/git-client run test:electron
git diff --check
```

전체 모노레포의 formatting, lint, workspace graph와 build까지 확인하려면 루트에서 다음 명령을 실행한다.

```sh
pnpm check
```

## 제출 체크리스트

- 실제 작업 저장소 대신 disposable fixture로 mutation을 확인했다.
- renderer API를 우회해 main IPC가 fail-closed인지 확인했다.
- 새 command의 manifest, handler, menu, tooltip과 disabled reason을 함께 갱신했다.
- snapshot은 의도적인 변경만 갱신하고 diff를 검토했다.
- `window.gitClient`와 shared schema 변경이 모든 process에 반영됐다.
- unrelated 파일을 stage하지 않았고 `git diff --check`가 통과한다.
