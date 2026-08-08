# Rebased 1.1.11 대비 Git Client 독립 감사

- 감사일: 2026-08-08
- 기준 앱: `/Applications/Rebased.app` 1.1.11
- 대상: Git Client 현재 통합 브랜치, package version `0.1.0`
- 플랫폼: macOS ARM64
- 최종 판정: **부분 구현**

## 결론

- 패키지는 정상 기동하며 `window.gitClient` preload bridge가 연결된다.
- 폴더·최근 프로젝트·복원, 로그·diff, stage·부분 stage·discard·commit·amend, branch CRUD·merge, stash, fetch·pull·push lease, rebase·cherry-pick conflict·continue·abort를 패키지의 보이는 UI에서 실행했다.
- 실제 임시 저장소의 `HEAD`, refs, index, working tree, stash, remote refs를 독립 oracle로 비교했고 신규 Git 중심 UI 시나리오 7개가 모두 통과했다.
- 확인된 UI 회귀였던 축소 geometry, 겹친 Log 필터, 전체 화면 Commit, 항상 보이는 bottom strip, toolbar 순서와 추가 Appearance 버튼을 한 배치로 수정했다.
- Welcome 800×650, Workbench 1184×768, 확대 Workbench 1584×918의 핵심 pane geometry와 overflow를 패키지에서 검증했다.
- 다만 Rebased의 advanced mutation 화면은 실제 앱의 `Paths` AX 메뉴 고착 때문에 원본 키보드 순회를 끝내지 못했고, `Preview in Safe Mode`는 아직 읽기 전용 격리를 강제하지 않는다.
- 따라서 Git 결과는 범위 내에서 동등하지만 전체 UI/UX를 **동일**로 판정할 근거는 아직 부족하다.
- 기존 `docs/rebased-parity.md`, `parity/rebased/**`, 저장 완료율과 1.1.8 판정은 이번 결론의 증거로 사용하지 않았다.

## 범위와 판정 규칙

- 포함: 폴더 열기, 최근 프로젝트와 재시작 복원, 로그·diff, stage·commit, branch, fetch·pull·push, stash, rebase·cherry-pick·conflict 복구.
- 제외: 플러그인, 일반 IDE 기능, Shelf, Local History, worktree, submodule.
- `동일`: 화면·키보드·확인 흐름·Git 결과가 직접 관찰 범위에서 모두 같다.
- `동등`: 화면의 미검증 차이는 남지만 Git 결과와 안전 흐름이 같다.
- `부분 구현`: 기능은 동작하지만 원본 증거 또는 안전·상호작용 계약이 완결되지 않았다.
- `누락`: 기능 또는 진입점이 없다.
- `고장`: 진입점이 현재 패키지에서 완료되지 않는다.

## 독립 검증 방법

- Rebased 1.1.11과 공식 `/Users/jongminchung/workspace/rebased/README.md`, `screenshot.png`를 직접 확인했다.
- 체크인된 원본 화면·AX·측정·SHA-256 manifest는 `independent-audit/rebased-1.1.11/evidence/`에 저장했다.
- 격리 profile, disposable repository, local bare remote를 사용했다.
- API 존재와 패키지 동작을 분리했다.
  - 계약: `GitOperationSchema`
  - 런타임: `window.gitClient`
  - 부작용: `HEAD`, refs, porcelain v2 status, cached/working diff, stash, remote refs
- Git mutation은 bridge 직접 호출이 아니라 packaged UI 클릭·키보드로 수행했다. CLI는 fixture 설정과 실행 후 oracle 판정에만 사용했다.

## 시나리오 결과

| 시나리오 | 실제 패키지 결과 | UI/UX 비교 | 판정 |
|---|---|---|---|
| 시작·preload | `ready=true`, `preloadApi=true`, exit 0 | 빈 화면·renderer 예외 없음 | **동등** |
| 폴더·recent·복원 | UI에서 open/recent/재시작 복원 통과 | Trust sheet 추가, safe-mode 격리는 미완성 | **부분 구현** |
| 로그·필터·상세·diff | OID/ref/file/diff 조회와 선택 통과 | 35px filter, 25px row, regular author, 장문 시간, marker 제거; Rebased diff 키보드 원본은 미확정 | **부분 구현** |
| stage·부분 stage·discard | index/worktree oracle 통과 | Commit 좌측 302px 도킹과 focused diff 동작 | **동등** |
| commit·amend | commit/parent/index oracle 통과 | composer focus·Esc draft 보존 구현, published amend 원본 확인 흐름 미확정 | **부분 구현** |
| branch CRUD·merge | `HEAD`, refs, merge parents oracle 통과 | 검색 focus·키보드·확인 구현, Rebased popup 원본 증거 미완결 | **부분 구현** |
| fetch·pull·push lease | local/remote refs 및 stale/exact lease 통과 | exact lease 확인 흐름 구현, 원본 라벨·Tab 순회 미완결 | **부분 구현** |
| stash | stash refs와 worktree 전이 통과 | VCS Operations 진입과 panel 동기화 통과, 원본 배치 미확정 | **부분 구현** |
| rebase abort | abort 후 시작 oracle 완전 복원 | top recovery Abort와 확인 흐름 동작 | **부분 구현** |
| cherry-pick conflict | conflict 편집·Save·Continue 통과 | 원본 3-way 배치·focus 계약 미확정 | **부분 구현** |
| Welcome 800×650 | 창 크기, 30px titlebar, 224px sidebar 검증 | action overflow 제거, More Actions 추가, Plugins는 제외 범위 | **동등** |
| Workbench 1184×768 | Project 458px, review 253px, toolbar 35px, tab 32px 검증 | toolbar 순서와 compact controls 정합화 | **동등** |
| Commit/Workbench 1584×918 | Commit 302px, Log 700px 초과, review 253px 동시 표시 | 공식 README의 좌측 Commit+Log+Review 구조와 일치 | **동등** |

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

## 남은 차이와 우선순위

- **P1 — Safe mode 의미 미완성**
  - Trust dialog의 구조·라벨·초기 Preview focus는 구현했다.
  - `Preview in Safe Mode`가 mutation을 차단하는 읽기 전용 session 경계는 아직 없다.
- **P1 — Advanced Rebased 상호작용 증거 부족**
  - branch, push lease, stash, conflict, rebase 화면의 실제 Rebased Tab·Enter·Esc·focus-return 전체 순회가 미완료다.
  - 후보 앱의 테스트가 통과해도 직접 원본 증거 없이는 `동일`로 승격하지 않는다.
- **P2 — 독립 raw capture 확장**
  - 1184×768과 1584×918의 동일 fixture 원본 캡처·DPR·logical rect manifest를 추가로 고정해야 한다.
- **범위 밖 게이트 상태**
  - 전체 Electron 20개 중 Git 중심 19개는 통과했다.
  - hosting/safeStorage 1개는 macOS credential 저장 호출에서 timeout 됐다. 이번 Git 중심 범위의 제품 UI·Git 부작용 실패로 분류하지 않는다.

## 패키지·테스트 증거

- `pnpm typecheck`: 성공.
- `pnpm test`: 단위 테스트 전체 성공.
- `pnpm test:e2e`: renderer 44개 성공.
- 신규 packaged UI→Git E2E: 7/7 성공.
- operation matrix: 51개 `GitOperationSchema` kind 회귀 없음.
- `pnpm electron:package`: 성공.
- `node scripts/smoke-electron-package.mjs`: `ready=true`, `preloadApi=true`, exit 0.
- `pnpm test:electron`: 19/20 성공, 범위 밖 hosting safeStorage timeout 1건.

## 재현 명령

```sh
cd /Users/jongminchung/workspace/jongminchung/apps/git-client
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm electron:package
node scripts/smoke-electron-package.mjs
pnpm test:electron
```

## 완료 조건

- Safe mode에서 모든 Git mutation과 실행성 기능을 실제로 차단한다.
- Rebased advanced mutation 화면의 라벨·포커스·Tab·Enter·Esc·확인창을 직접 증거로 고정한다.
- 동일 fixture의 1184×768·1584×918 raw capture와 logical geometry manifest를 완성한다.
- 범위 내 모든 항목이 직접 증거와 함께 `동일` 또는 허용된 `동등`일 때만 전체 완료로 바꾼다.

## API 영향

- 공개 `window.gitClient`와 `GitOperationSchema`는 변경하지 않았다.
