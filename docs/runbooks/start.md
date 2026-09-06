# AI 없이 첫 변경 완료하기

이 안내의 목표는 새 유지보수자가 편집기와 터미널만으로 실행, 수정, 검증,
복구를 수행하는 것이다. 명령은 `jongminchung` 저장소 루트에서 실행한다.
AI 대화 기록이나 에이전트 skill을 읽어야만 알 수 있는 작업 절차를 만들지 않는다.

## 첫 실행

1. `git status --short --branch`로 기존 변경을 확인한다. 다른 사람의 변경이
   있으면 담당 범위를 확인하고, 새 작업은 별도 브랜치나 worktree에서 진행한다.
2. [.bun-version](../../.bun-version), [.node-version](../../.node-version),
   [mise.toml](../../mise.toml)의 도구를 설치한다. `make`, Bash와 Git도 필요하다.
   mise를 쓰지 않아도 같은 버전의 Bun, Node, shfmt를 PATH에 설치하면 된다.
3. 아래 명령으로 설치하고 Tech 화면을 연다. mise 사용자는 먼저 `mise trust`,
   `mise install`을 실행하고 명령 앞에 `mise exec --`를 붙일 수 있다.

```sh
bun --version
node --version
shfmt --version
bun install --frozen-lockfile
bun run --filter @jongminchung/web dev:tech
```

브라우저에서 `http://localhost:3000/ko`와 `http://localhost:3000/en`을 확인한다.
서버를 `Ctrl+C`로 종료한 뒤 `dev:home`, `dev:invest`로 다른 사이트도 실행한다.
설치는 루트에서 한 번만 한다. 로컬 공용 패키지는 `workspace:*`로 연결된다.
기본 Web 실행·콘텐츠 편집에는 AI API 키가 필요하지 않다.

## 할 일에서 출발하기

| 작업                            | 수정 위치와 실행 절차                                                             |
| ------------------------------- | --------------------------------------------------------------------------------- |
| 글 추가, 번역, 공개·비공개 전환 | [콘텐츠 편집과 발행](content.md)                                                  |
| 화면, 메뉴, 검색, URL 수정      | [Web 수정 위치 지도](../web/README.md)                                            |
| 버튼, 테마, 공용 UI API 수정    | [디자인 시스템](../../DESIGN_SYSTEM.md), [UI 패키지](../../packages/ui/README.md) |
| 의존성·도구 버전 갱신           | [유지보수 가이드](../maintenance.md)                                              |
| 검사 실패, 사이트 장애          | [장애 진단과 복구](recovery.md)                                                   |
| Web 배포, 패키지 게시, 인수인계 | [배포와 인수인계](release.md)                                                     |
| 요청·모듈 구조 이해             | [온보딩](../onboarding.md)                                                        |

처음에는 기존 문서의 오탈자나 한 화면의 문구처럼 결과를 눈으로 확인할 수 있는
변경을 선택한다. 코드가 필요하면 [Web 안내](../web/README.md)의 요청 경로를
따라 `proxy.ts` → 콘텐츠 로더 → `page.tsx` → component 순서로 추적한다.

## 검증을 선택하기

| 변경                   | 실행할 검사                                                                           | 성공 판단                                          |
| ---------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `docs` Markdown만 수정 | `bun run fmt:check`, `bun run links:check`                                            | 형식과 로컬 링크·anchor 오류 없음                  |
| MDX 원본 수정          | Web `typecheck`, `test`, `build`                                                      | 번역·schema·본문·경로 검증 통과, 두 언어 화면 확인 |
| Web 코드 수정          | Web `typecheck`, `test`, `test:e2e`, 루트 `check`                                     | 규칙 검사와 해당 브라우저 시나리오 통과            |
| 공용 UI 수정           | UI `typecheck`, `test:coverage`, `test:node`, Web `typecheck`, 관련 E2E, 루트 `check` | 소스와 배포 import, 소비 화면 확인                 |
| 공용 tooling 수정      | Tooling `typecheck`, `test:coverage`, `test:node`, 루트 `check`                       | 설정 소비와 배포 패키지 검증 통과                  |
| 의존성 또는 배포 변경  | `bun run check:full`, `bun run audit`, 대상 배포 사전 검증                            | 전체 검사와 보안 점검, 배포 대상 확인              |

표에서 Web 명령은 `bun run --filter @jongminchung/web <script>`, UI와 Tooling은
각각 `@jongminchung/ui`, `@jongminchung/tooling` 필터를 사용한다.
`bun run check`는 `make lint` → 타입 검사 → Knip → 커버리지 테스트와 Node
패키지 검증을 실행한다. `check:full`은 여기에 E2E를 더한다.

Playwright 최초 실행에는 Chromium과 시스템 의존성이 필요하다.

```sh
bunx playwright install --with-deps chromium
bun run --filter @jongminchung/web test:e2e --workers=2
```

Playwright는 3100 포트에 서버가 없으면 테스트용 production build와 서버 시작을
수행한다. 별도 build가 선행 조건은 아니다. 일반 배포 build는 별도로 확인한다.
Docker는 링크 검사와 컨테이너 검증에 필요하다. 첫 이미지 다운로드·의존성 설치·
브라우저 설치·보안 점검에는 네트워크가 필요하다.

## 변경 완료와 문서 갱신

```sh
git diff --check
git diff --stat
git status --short
```

변경 설명에 목적, 사용자 영향, 실행 명령과 결과, 실행하지 못한 검사와 이유,
되돌릴 commit 또는 배포 식별자를 남긴다. 화면 변경은 전후 화면도 확인한다.
검사 실패를 없애기 위해 snapshot·coverage 기준·예외 목록을 무조건 갱신하지 않는다.

명령은 `package.json`, 실행 도구는 버전 파일, CI는 `.github/workflows`,
콘텐츠 필드는 schema가 기준이다. 이들 계약이 바뀌면 관련 안내를 같은 변경에서
수정한다. 새 절차에는 시작 위치, 필요한 권한·도구, 실행 명령, 성공 판단,
실패 시 다음 단계까지 적는다. 해결하지 못한 사항은 [이슈 목록](../issues/README.md)에
재현 방법과 완료 조건을 남긴다.
