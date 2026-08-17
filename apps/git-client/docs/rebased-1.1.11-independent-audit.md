# Rebased 1.1.11 대비 Git Client 독립 감사

- 감사일: 2026-08-09
- 기준 앱: `/Applications/Rebased.app` 1.1.11
- 대상: Git Client `main` 통합 대상, package version `1.0.0`
- 플랫폼: macOS ARM64
- 최종 판정: **동등 — 범위 구현 및 패키지 검증 완료**

## 결론

- 패키지는 정상 기동하며 `window.gitClient` preload bridge가 연결된다.
- 폴더·최근 프로젝트·복원, 로그·diff, stage·부분 stage·discard·commit·amend, branch CRUD·merge, stash, fetch·pull·push lease, rebase·cherry-pick conflict·continue·abort를 패키지의 보이는 UI에서 실행했다.
- 실제 임시 저장소의 `HEAD`, refs, index, working tree, stash, remote refs를 독립 oracle로 비교했고 신규 Git 중심 UI 시나리오 7개가 모두 통과했다.
- 확인된 UI 회귀였던 축소 geometry, 겹친 Log 필터, 전체 화면 Commit, 항상 보이는 bottom strip, toolbar 순서와 추가 Appearance 버튼을 한 배치로 수정했다.
- Welcome 800×650, Workbench 1184×768, 확대 Workbench 1584×918의 핵심 pane geometry와 overflow를 패키지에서 검증했다.
- `Preview in Safe Mode`는 renderer와 main IPC 양쪽에서 Git mutation, working-tree write/open, Terminal, hosting, 외부 실행을 fail-closed로 차단한다. Safe 상태는 close·recent·재시작에도 보존된다.
- 전체 Electron 21개, 신규 Safe Mode·hosting, 기존 operation matrix 51종이 모두 통과했다.
- 실제 Rebased에서 branch popup의 라벨·검색·Fetch·Settings·Esc 고착 재현까지 추가 확인했다. 다만 advanced popup의 전체 Tab 순회는 Rebased 자체 `Paths` AX 메뉴 고착 때문에 인증할 수 없으므로 전체 판정은 **동일**이 아니라 **동등**이다.
- 결론은 이 문서에 기록한 1.1.11 원본 증거와 현재 패키지 검증만을 근거로 한다.

## 범위와 판정 규칙

- 포함: 폴더 열기, 최근 프로젝트와 재시작 복원, 로그·diff, stage·commit, branch, fetch·pull·push, stash, rebase·cherry-pick·conflict 복구.
- 제외: 플러그인, 일반 IDE 기능, Shelf, Local History, worktree, submodule.
- `동일`: 화면·키보드·확인 흐름·Git 결과가 직접 관찰 범위에서 모두 같다.
- `동등`: 화면의 미검증 차이는 남지만 Git 결과와 안전 흐름이 같다.
- `부분 구현`: 기능은 동작하지만 원본 증거 또는 안전·상호작용 계약이 완결되지 않았다.
- `누락`: 기능 또는 진입점이 없다.
- `고장`: 진입점이 현재 패키지에서 완료되지 않는다.

## 독립 검증 방법

- Rebased 1.1.11과 공식 README 화면을 직접 확인했다.
- 체크인된 원본 화면·AX·측정·SHA-256 manifest는 `independent-audit/rebased-1.1.11/evidence/`에 저장했다.
- 격리 profile, disposable repository, local bare remote를 사용했다.
- API 존재와 패키지 동작을 분리했다.
  - 계약: `GitOperationSchema`
  - 런타임: `window.gitClient`
  - 부작용: `HEAD`, refs, porcelain v2 status, cached/working diff, stash, remote refs
- Git mutation은 bridge 직접 호출이 아니라 packaged UI 클릭·키보드로 수행했다. CLI는 fixture 설정과 실행 후 oracle 판정에만 사용했다.

## 시나리오 결과

| 시나리오                  | 실제 패키지 결과                                         | UI/UX 비교                                                        | 판정     |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| 시작·preload              | `ready=true`, `preloadApi=true`, exit 0                  | 빈 화면·renderer 예외 없음                                        | **동등** |
| 폴더·recent·복원          | UI에서 open/recent/재시작 복원 통과                      | Trust sheet와 실제 read-only Safe Mode, close/recent/restart 보존 | **동등** |
| 로그·필터·상세·diff       | OID/ref/file/diff 조회와 선택 통과                       | compact filter/row, regular author, 장문 시간, marker 제거        | **동등** |
| stage·부분 stage·discard  | index/worktree oracle 통과                               | Commit 좌측 302px 도킹과 focused diff 동작                        | **동등** |
| commit·amend              | commit/parent/index oracle 통과                          | composer focus·Esc draft 보존과 위험 확인 흐름                    | **동등** |
| branch CRUD·merge         | `HEAD`, refs, merge parents oracle 통과                  | 실제 Rebased branch popup 라벨·검색과 후보 키보드·확인 흐름 검증  | **동등** |
| fetch·pull·push lease     | local/remote refs 및 stale/exact lease 통과              | stale 차단과 exact lease 승인 흐름                                | **동등** |
| stash                     | stash refs와 worktree 전이 통과                          | VCS Operations 진입과 panel 동기화                                | **동등** |
| rebase abort              | abort 후 시작 oracle 완전 복원                           | top recovery Abort와 확인 흐름                                    | **동등** |
| cherry-pick conflict      | conflict 편집·Save·Continue 통과                         | 3-way conflict, continue/abort와 복원                             | **동등** |
| Welcome 800×650           | 창 크기, 30px titlebar, 224px sidebar 검증               | action overflow 제거, More Actions 추가, Plugins는 제외 범위      | **동등** |
| Workbench 1184×768        | Project 458px, review 253px, toolbar 35px, tab 32px 검증 | toolbar 순서와 compact controls 정합화                            | **동등** |
| Commit/Workbench 1584×918 | Commit 302px, Log 700px 초과, review 253px 동시 표시     | 공식 README의 좌측 Commit+Log+Review 구조와 일치                  | **동등** |

## 이번 배치에서 해소한 차이

- downscaled screenshot 픽셀을 CSS logical px로 사용하던 약 23% 밀도 오류 수정.
- Commit 선택 시 Log·Review를 숨기던 구조를 좌측 tool window 도킹으로 복원.
- collapsed bottom panel에서 Shelf·Stash 등 범위 밖 tab strip이 노출되던 회귀 제거.
- Log filter control 높이·라벨 clipping, author weight, 과도한 date 폭, graph의 push/pull 텍스트 겹침 수정.
- toolbar를 `Project → Update → Push → branch → Search → Settings`로 정렬하고 Workbench Appearance 버튼 제거.
- 기본 dark appearance, shortcut-conflict balloon 비표시, Welcome action overflow와 recent overflow menu 수정.
- 비위험 dialog의 destructive 색상과 위험 dialog 초기 focus·trigger focus 복귀 수정.
- normal push는 primary, force-with-lease만 destructive로 구분.
- stash command의 bottom panel double-toggle 경쟁 조건 수정.
- rebase/cherry-pick abort가 recovery snapshot의 refs·index·worktree·stash를 정확히 복원하도록 수정.
- Safe Mode 정책을 renderer와 main-process IPC에 이중 적용하고 공개 bridge 직접 호출 우회 차단.
- Safe Mode에서 파일 Inspector를 read-only로 전환하고 기존 PTY를 종료.
- safe repository trust 상태를 close·recent·restart 전반에서 보존하고 명시적 Trust/Recent 제거만 해제하도록 수정.
- QA hosting profile의 credential 검증을 macOS Keychain prompt와 분리해 전체 Electron suite를 결정론화.

## 원본 검증 제약

- Rebased 1.1.11은 branch/action popup 진입 뒤 AX가 `Window → Paths: Paths` 하나로 고착된다.
- Esc, 외부 클릭과 두 번째 Esc로 복구되지 않고 앱 재시작이 필요함을 반복 재현했다.
- 따라서 advanced popup의 원본 Tab·Enter·Esc 전체 순회는 “미구현”이 아니라 “기준 앱에서 접근 불가”로 기록한다.
- 후보 앱은 해당 흐름을 visible packaged UI와 Git oracle로 검증했지만, 이 제약 때문에 전체 판정은 `동일`로 승격하지 않는다.

## 패키지·테스트 증거

- `pnpm typecheck`: 성공.
- `pnpm test`: 단위 테스트 전체 성공.
- `pnpm test:e2e`: renderer 33개 성공.
- 단위 테스트: 111 files, 785개 성공.
- renderer E2E: 33/33 성공.
- 신규 packaged UI→Git E2E: 기존 7개와 Safe Mode 시나리오 성공.
- operation matrix: 51개 `GitOperationSchema` kind 회귀 없음.
- `pnpm electron:package`: 성공.
- `node scripts/smoke-electron-package.ts`: `ready=true`, `preloadApi=true`, exit 0.
- `pnpm test:electron`: 21/21 성공.

## 재현 명령

모노레포 루트에서 실행한다.

```sh
pnpm --filter @jongminchung/git-client typecheck
pnpm --filter @jongminchung/git-client test
pnpm --filter @jongminchung/git-client test:e2e
pnpm --filter @jongminchung/git-client test:integration:native
pnpm --filter @jongminchung/git-client electron:package
pnpm --filter @jongminchung/git-client electron:verify-package
pnpm --filter @jongminchung/git-client electron:smoke-package
pnpm --filter @jongminchung/git-client test:electron
```

## 완료 상태

- Safe Mode의 모든 Git mutation과 실행성 기능 차단: 완료.
- 공개 bridge/schema 유지 및 main IPC 우회 차단: 완료.
- 동일 fixture의 Welcome 800×650, Workbench 1184×768·1584×918 후보 geometry 검증: 완료.
- 범위 내 Git 결과와 안전 흐름: 모두 동등.
- Rebased 자체 AX blocker는 별도 검증 제약으로 남기며 제품 구현 blocker는 없다.

## API 영향

- 공개 `window.gitClient`와 `GitOperationSchema`는 변경하지 않았다.
