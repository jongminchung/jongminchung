# Rebased 1.1.11 대비 Git Client 독립 감사

- 감사일: 2026-08-08
- 기준 앱: `/Applications/Rebased.app` 1.1.11
- 대상 소스: Git Client `4712947`, package version `0.1.0`
- 플랫폼: macOS ARM64
- 최종 판정: **부분 구현**

## 결론

- 최신 Git Client 패키지는 정상 기동하며 `window.gitClient` preload bridge가 연결된다.
- 폴더 열기·최근 프로젝트 복원과 범위 내 Git operation은 실제 저장소에 기대한 부작용을 만든다.
- 전체 51개 `GitOperationSchema` kind의 패키지 operation matrix가 통과했다.
- Rebased의 주요 3분할 작업대와 Islands 계열 표현은 모방했지만 기본 패널, 폭, 행 밀도, 그래프 표현, 선택 상태와 알림 배치가 같지 않다.
- 따라서 **Git 기능은 대체로 동등하지만 UI/UX 동일 조건은 충족하지 못한다.**
- 이번 감사에서 `docs/rebased-parity.md`, `parity/rebased/**`, 저장된 완료율과 기존 parity 판정은 증거로 사용하지 않았다.

## 범위와 판정 규칙

- 포함: 폴더 열기, 최근 프로젝트와 재시작 복원, 로그·diff, stage·commit, branch, fetch·pull·push, stash, rebase·cherry-pick·conflict 복구.
- 제외: 플러그인, 일반 IDE 기능, Shelf, Local History, worktree, submodule.
- `동일`: 화면·상호작용·Git 결과가 관찰 가능한 범위에서 모두 같다.
- `동등`: 화면은 다를 수 있지만 작업 결과와 안전 흐름이 같다.
- `부분 구현`: 기능이나 화면은 있으나 일부 흐름·표현·독립 증거가 기준에 미달한다.
- `누락`: 해당 기능이나 진입점이 없다.
- `고장`: 진입점은 있으나 현재 패키지에서 완료되지 않는다.

## 독립 검증 방법

- 설치 앱 버전과 바이너리를 직접 확인했다.
  - Rebased: `1.1.11`
  - 실행 파일 SHA-256: `4bfd68b12a753eb271ca9c8e60c954a6bd73004f68a2d7b1c9e25e88d8f066f8`
- 공식 기준 화면은 `/Users/jongminchung/workspace/rebased/README.md`와 `screenshot.png`를 사용했다.
  - `screenshot.png` SHA-256: `565bebe2ad86c2e2b76e2037618819526dcb5438caa4756ae9bc31df8dda8d46`
- 로컬 bare remote와 동일한 초기 상태의 두 clone을 만들었다. Rebased에는 기준 clone을 열었고, Git Client의 실제 부작용은 별도 격리 profile과 disposable clone을 쓰는 packaged operation matrix로 교차 확인했다.
- Git Client는 최신 소스에서 Electron 앱을 다시 패키징한 뒤 smoke, renderer, packaged Electron 검증을 실행했다.
- API 존재 여부와 패키지 동작 여부를 분리했다.
  - 계약 경계: `GitOperationSchema`
  - 런타임 경계: `window.gitClient`
  - 실제 부작용 경계: 임시 저장소의 `HEAD`, refs, index, working tree, stash와 remote refs
- 네이티브 폴더 선택기의 `Open` 활성화와 Rebased의 모든 mutation 대화상자 순회는 접근성 자동화로 끝까지 재현하지 못했다. 이 항목은 제품 고장이 아니라 감사 자동화 제한이며, 직접 대응 증거가 없는 시나리오를 `동일`로 올리지 않았다.

## 시나리오 결과

| 시나리오 | 소스/API | 현재 패키지와 Git 결과 | UI/UX 비교 | 판정 |
|---|---|---|---|---|
| 패키지 시작·preload | bridge와 schema 존재 | smoke `ready=true`, `preloadApi=true`, exit 0 | 빈 화면 재현 안 됨 | **동등** |
| 폴더 열기·최근 프로젝트·재시작 복원 | open/clone/settings 경계 존재 | 실제 두 저장소 목록과 활성 저장소가 재시작 후 복원됨 | Rebased Welcome/프로젝트 선택기와 크기·구성이 다름 | **부분 구현** |
| 로그 그래프·필터·선택·상세·diff | log/details/diff query 존재 | 실제 commit OID, ref, 변경 파일을 패키지에서 조회함 | 기본 선택 상태, 행 밀도, 그래프 색·선, 우측 상세 구성이 다름 | **부분 구현** |
| stage·unstage·부분 stage·discard | operation과 patch 경계 존재 | index와 working tree 결과가 실제 Git 명령 결과와 일치 | 변경 패널이 Rebased처럼 기본 좌측 패널로 열리지 않음 | **부분 구현** |
| commit·amend | 일반/고급 commit operation 존재 | commit 생성과 advanced options 부작용 통과 | 작성 영역 기본 배치와 밀도가 다름 | **부분 구현** |
| branch 생성·전환·이름 변경·삭제·merge | 관련 operation 존재 | refs와 `HEAD` 전이가 실제 저장소에서 통과 | 팝업 구조, 기본 포커스와 키보드 동작의 1.1.11 원본 증거 부족 | **부분 구현** |
| fetch·pull·push | 관련 operation과 preview 존재 | local/remote refs 부작용 통과 | Rebased와 같은 대화상자·확인 흐름이라는 독립 증거 부족 | **부분 구현** |
| non-fast-forward·force-with-lease | 정확한 ref/OID lease 계약 존재 | exact `--force-with-lease=<ref>:<oid>` 경계 통과 | 안전 흐름은 있으나 라벨·포커스·확인창 동일성 미확인 | **부분 구현** |
| stash 생성·적용·삭제 | stash operation 존재 | stash refs와 working tree 전이 통과 | 하단 Stash 진입점은 있으나 Rebased와 배치·상호작용이 다름 | **부분 구현** |
| rebase·cherry-pick | operation과 rewrite preview 존재 | 실제 commit/refs 전이와 operation 완료 통과 | 전용 workspace는 있으나 Rebased 1.1.11 화면과 동일하지 않음 | **부분 구현** |
| conflict·continue·abort | recovery operation 존재 | conflict 생성, 표시용 상태, continue/abort 부작용 통과 | 표시·Esc·확인창의 원본 대비 전체 키보드 검증이 부족 | **부분 구현** |
| Welcome 800×650 | geometry test 존재 | 패키지 창 800×650 검증 통과 | 설치된 Rebased Welcome은 현재 상태에서 약 1016×720으로 관찰됨 | **부분 구현** |
| Workbench 1184×768 | shell geometry assertion 존재 | 앱은 렌더링되나 13개 Electron 검사 중 1개 실패 | Log tab 좌우 padding 6px, 요구치 7px 미달 | **고장** |

## UI/UX 차이

- Rebased 공식 화면은 변경이 있는 프로젝트에서 좌측 `Commit` 패널과 commit message 입력을 전면에 둔다.
- Git Client 기본 화면은 좌측 `Project` 패널을 열고 우측은 커밋을 선택하기 전까지 빈 안내 상태다.
- 같은 1584×918 비교에서 Git Client 좌측 패널이 더 넓고 로그 행이 더 조밀하다.
- commit graph의 색상과 선 표현이 다르다.
- 상단 제품 chrome, 프로젝트·브랜치·update·push 컨트롤의 간격과 아이콘 구성이 다르다.
- Git Client는 깨끗한 기본 실행에서도 `Shortcuts conflicts` 알림이 우측 하단 내용을 가릴 수 있다.
- Git Client 자체 Electron geometry 검사가 Log tab padding 차이를 검출해 실패한다.

## 패키지·테스트 증거

- `pnpm electron:package`: 성공.
- `node scripts/smoke-electron-package.mjs`: 성공.
  - `ready: true`
  - `preloadApi: true`
  - `exitCode: 0`
- `pnpm qa:compact`: typecheck 성공, 단위 테스트 808개 성공, renderer 42개 성공.
- `pnpm test:electron`: 12개 성공, 1개 실패.
  - 실패: `electron-tests/app.spec.ts:167`
  - 기대: Log tab horizontal padding `>= 7px`
  - 실제: `6px`
- `electron-tests/operation-matrix.spec.ts`: 51개 operation kind 전부 실제 임시 저장소 부작용과 함께 성공.
- 결과 파일:
  - `test-results/qa/renderer.json`
  - `test-results/qa/electron.json`

## 우선순위 차이 목록

- **P1 — 기본 작업 화면 불일치**
  - 재현: 변경 파일이 있는 저장소를 Rebased와 Git Client에서 각각 연다.
  - 기대: Commit 패널, 로그, 선택 커밋 상세가 같은 기본 배치와 상태로 보인다.
  - 실제: Git Client는 Project 패널과 미선택 상세 상태로 시작한다.
- **P1 — Workbench geometry gate 실패**
  - 재현: `pnpm test:electron`.
  - 기대: Log tab horizontal padding이 최소 7px다.
  - 실제: 6px다.
- **P1 — 상호작용 원본 증거 부족**
  - 재현: branch, push lease, conflict, rebase 대화상자를 1.1.11에서 키보드로 순회한다.
  - 기대: 라벨, 포커스 순서, 단축키, Esc, 확인창이 동일하다.
  - 실제: 후보 앱 테스트는 있으나 1.1.11에서 새로 수집한 대응 증거가 완결되지 않았다.
- **P2 — 밀도·그래프·알림 차이**
  - 재현: 1584×918에서 동일 저장소 로그를 연다.
  - 기대: 패널 폭, 행 높이, graph palette와 오버레이가 같다.
  - 실제: Git Client가 더 조밀하고 graph palette가 다르며 shortcut 알림이 표시된다.
- **P2 — Rebased 저장소 메타데이터 부작용**
  - Rebased는 임시 저장소에 `.idea`를 만들었다. 전역 ignore로 Git 상태에는 나타나지 않았으며 이번 핵심 Git 범위의 합격 여부에는 반영하지 않았다.

## 재현 명령

```sh
cd /Users/jongminchung/workspace/jongminchung/apps/git-client
pnpm electron:package
node scripts/smoke-electron-package.mjs
pnpm qa:compact
pnpm test:electron
```

현재 기대 결과는 앞의 세 명령 성공, 마지막 명령 12/13 성공과 padding 1건 실패다.

## 완료 조건

- 1.1.11 실제 앱에서 Welcome, Commit, Log, branch, push lease, conflict, rebase 화면과 키보드 상태를 새로 고정한다.
- 기본 tool window, 패널 폭, 행 높이, graph, 선택 상태, 알림을 기준 화면에 맞춘다.
- 모든 범위 시나리오에서 실제 Git 결과와 UI 상태를 함께 재검증한다.
- Electron 13/13과 범위 시나리오가 모두 `동일` 또는 허용된 `동등`일 때만 전체 완료로 바꾼다.

## API 영향

- 감사 과정에서 공개 API와 타입은 변경하지 않았다.
- `window.gitClient`와 `GitOperationSchema`는 관찰·검증 경계로만 사용했다.
