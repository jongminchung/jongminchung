# Git Client 기여 가이드

Git Client는 React UI와 Rust Git bridge를 함께 실행하는 Tauri 데스크톱 애플리케이션이다. 실제 저장소·stash·파일·Terminal 기능은 Tauri 앱에서 확인하고, 레이아웃과 상호작용은 명시적인 브라우저 fixture로 빠르게 확인한다.

## 사전 요구사항

- macOS 26 이상
- Node.js 26.5.0 (`.node-version`)
- pnpm 11.13.0
- Rust stable
- 시스템 Git 2.39 이상

저장소 루트에서 의존성을 설치한다.

```sh
node --version
pnpm --version
git --version
pnpm install --frozen-lockfile
```

## 데스크톱 앱 개발

실제 Git 저장소, 네이티브 디렉터리 선택기와 Tauri bridge를 확인할 때는 다음 명령 하나를 실행한다.

```sh
pnpm --filter @jongminchung/git-client dev
```

Tauri가 `pnpm dev:web`으로 Vite 개발 서버를 `http://localhost:1420`에 시작한 뒤 macOS 앱 창을 연다. 앱은 닫을 수 없는 **Manage** 탭으로 시작하며, 여기서 저장소를 열면 저장소별 탭이 추가된다. 탭 순서와 활성 탭은 재시작 후 복원된다.

| 변경 대상                        | 개발 중 반영 방식                        |
| -------------------------------- | ---------------------------------------- |
| React, TypeScript, CSS           | WebView에 HMR로 즉시 반영                |
| `src-tauri` Rust 코드            | 자동 재빌드 후 앱 재시작                 |
| 열어 둔 Git 저장소의 파일과 refs | 250ms debounce 후 상태 조회를 한 번 실행 |

macOS Web Inspector는 앱에서 `⌘⌥I`를 눌러 연다. Rust 로그와 앱 재시작 상태는 `pnpm dev`를 실행한 터미널에서 확인한다. 개발 세션은 해당 터미널에서 `Ctrl+C`로 종료한다.

1420 포트가 이미 사용 중이면 Vite의 `strictPort` 설정 때문에 새 개발 서버가 시작되지 않는다. 기존 프로세스를 먼저 확인한다.

```sh
lsof -nP -iTCP:1420 -sTCP:LISTEN
```

## 브라우저 fixture 개발

레이아웃, 컨텍스트 메뉴, diff와 키보드 흐름만 빠르게 확인할 때는 브라우저 모드를 사용한다.

```sh
pnpm --filter @jongminchung/git-client dev:web
```

일반 `http://localhost:1420`은 mock 저장소를 자동으로 표시하지 않는다. 네이티브 bridge가 없는 브라우저 모드라는 안내와 빈 Manage 화면만 보여 준다. 결정적인 QA fixture가 필요할 때만 다음 URL을 명시적으로 연다.

```text
http://localhost:1420/?fixture=qa
```

QA fixture는 네이티브 디렉터리 선택기, 실제 Git bridge와 PTY를 실행하지 않는다. 실제 저장소 상태나 변경 작업을 확인해야 한다면 `pnpm dev`로 전환한다.

## Activity와 Terminal

하단의 두 도구창은 역할과 권한이 다르다.

- Git 요청은 상태바에 안전한 진행·취소·실패 요약만 일시적으로 표시한다. stdout/stderr와 명령 인자는 완료 후 보관하지 않는다.
- **Terminal**은 현재 저장소를 cwd로 하여 사용자의 기본 셸을 실행한다. Git allowlist를 적용하지 않으므로 입력한 명령은 사용자 계정의 전체 권한으로 실행된다.

Terminal UI와 xterm.js는 처음 Terminal 탭을 열 때 로드된다. 저장소 탭을 바꿔도 PTY는 유지되지만, 저장소 탭을 닫으면 해당 저장소의 실행 중인 Terminal을 종료할지 확인한다. 앱 재시작 시 탭 이름은 복원되며 셸 프로세스는 새로 시작한다.

Appearance의 System/White/Black 전환은 PTY를 재시작하지 않고 xterm 팔레트만 교체한다. 터미널 smoke test에서는 출력과 scrollback을 만든 뒤 세 모드를 전환해 같은 세션이 유지되는지 확인한다.

## Command registry와 macOS menu

고정 단축키를 추가하거나 변경할 때는 `src/command-manifest.json`을 먼저 수정한다. TypeScript는 외부 JSON을 검증한 뒤 현재 화면의 handler와 disabled reason을 등록하고, Rust는 같은 manifest로 native menu와 accelerator를 구성한다. 새 command는 palette, renderer handler, native enabled/check state, TypeScript 중복 검사, Rust manifest 테스트를 함께 갱신해야 한다.

Terminal과 CodeMirror에 focus가 있을 때 Git mutation 단축키를 가로채지 않는다. 예외는 palette, History/Changes 전환, bottom drawer, repository/terminal tab 닫기이며, conflict editor의 `⌘S`는 명시적으로 save handler를 우선 등록한다. `Esc` 동작을 추가할 때는 dismiss priority를 사용하고 draft나 working tree를 직접 지우지 않는다.

읽기 전용 파일 뷰어는 Tree, 커밋 파일, staged/unstaged 변경에서 열 수 있다. 5 MiB 또는 50,000줄을 넘는 파일, binary와 비 UTF-8 파일은 내용을 렌더링하지 않고 상태와 크기만 표시한다.

## 안전한 Git 기능 확인

reset, rebase, stash, shelf, conflict와 worktree 같은 변경 작업은 실제 작업 저장소가 아닌 임시 저장소에서 확인한다.

```sh
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/git-client-dev.XXXXXX")"

git -C "$FIXTURE" init -b main
git -C "$FIXTURE" config user.name "Git Client Dev"
git -C "$FIXTURE" config user.email "git-client-dev@example.com"
echo "fixture" > "$FIXTURE/fixture.txt"
git -C "$FIXTURE" add fixture.txt
git -C "$FIXTURE" commit -m "chore: initialize fixture"

echo "$FIXTURE"
```

출력된 경로를 Tauri 앱의 **Open Repository**로 연다. 테스트가 끝나면 경로를 다시 확인한 뒤 임시 디렉터리를 정리한다.

## Rust DTO와 TypeScript 바인딩

`src-tauri/src/model.rs`의 DTO를 변경하면 `ts-rs` 바인딩을 다시 생성하고 변경 내용을 확인한다.

```sh
cargo test \
  --manifest-path apps/git-client/src-tauri/Cargo.toml \
  export_bindings

git diff -- apps/git-client/src/generated
pnpm --filter @jongminchung/git-client typecheck
```

Rust DTO, 생성된 TypeScript 타입과 `GitBridge` 호출 형태는 하나의 변경으로 함께 제출한다.

## 검증

기능을 개발하는 동안 변경 영역에 맞는 검사를 반복하고, 제출 전 전체 Git Client 검증을 실행한다.

```sh
pnpm --filter @jongminchung/git-client typecheck
pnpm --filter @jongminchung/git-client test
pnpm --filter @jongminchung/git-client rust:check
pnpm --filter @jongminchung/git-client test:e2e
pnpm --filter @jongminchung/git-client build
```

Playwright 시각 결과가 의도적으로 변경된 경우에만 스냅샷을 갱신하고 diff를 검토한다.

```sh
pnpm --filter @jongminchung/git-client test:e2e:update
```

릴리스, DMG와 최초 릴리스 멱등 검증 절차는 [GitHub Release 배포 가이드](docs/releases.md)를 따른다.
