# 유지보수 가이드

이 문서는 Bun 모노레포를 직접 운영할 때 반복되는 점검과 배포 절차를 정리한다.
처음 작업할 때는 [첫 변경 절차](runbooks/start.md), 장애 발생 시에는
[진단과 복구](runbooks/recovery.md), 게시 시에는 [배포·인수인계](runbooks/release.md)를 따른다.
일반 개발 규칙은 [기여 가이드](CONTRIBUTING.md)를 따른다. `plugins/go-lsp`는 이 문서의
범위에서 제외한다.

## 기본 점검

| 시점           | 실행·확인 항목                                                    |
| -------------- | ----------------------------------------------------------------- |
| 변경 시작 전   | `git status --short --branch`, Bun·Node 버전, 관련 workspace 문서 |
| 일반 변경 후   | 관련 typecheck·test, `bun run check`, `git diff --check`          |
| 문서 변경 후   | `bun run fmt:check`, `bun run links:check`, manifest와 명령 대조  |
| UI·E2E 변경 후 | 관련 Playwright와 screenshot·trace·snapshot diff                  |
| 의존성 변경 후 | manifest·catalog·lockfile·공식 release note, `check:full`         |
| 릴리스 전      | `check:full`, `audit`, 해당 package·app dry-run                   |

`bun run check`는 네트워크 없이 재현 가능한 기본 gate다. Next.js build와 core E2E까지
포함하려면 `bun run check:full`을 사용한다.

## 의존성 업데이트

`renovate.json`은 Bun lockfile과 GitHub Actions를 관리한다. npm 업데이트는 framework, UI,
test, tooling lane별 PR로 묶고, major 업데이트는 Dependency Dashboard 승인이 있어야
열리며, lockfile maintenance는 Asia/Seoul 기준 월요일 오전 4시 이전에 예약되어 있다.

수동 점검과 업데이트는 다음 순서로 진행한다.

```sh
bun outdated --recursive
# 루트 catalog 또는 해당 package.json의 대상 버전 변경
bun install
git diff -- bun.lock bunfig.toml package.json apps packages
```

수동 업데이트도 선택한 lane의 직접 dependency만 manifest와 catalog에서 변경한 뒤
`bun install`을 실행한다. 전이 dependency 변경은 허용하지만 한 PR의 직접 dependency 목적은
한 lane으로 유지한다. 여러 lane을 결합해야 하면 결합 이유와 lane별 rollback 단위를 변경 설명에
기록한다.

| Lane      | 대표 범위                                | 최소 검증                                                  |
| --------- | ---------------------------------------- | ---------------------------------------------------------- |
| framework | React, Next.js, MDX runtime              | Web build, Web E2E                                         |
| UI        | Tailwind, Base UI, shadcn, UI dependency | UI test, Web build, 영향받는 interaction test              |
| test      | Bun test, Playwright, axe, coverage      | reporter·fixture test, 대표 unit·integration·browser suite |
| tooling   | TypeScript, Oxc, content tooling         | `bun run check`, 영향받는 package build                    |

dependency PR 설명에는 **lane**, 주요 release note와 migration 유무, 실행한 최소 검증,
major update의 rollback 조건을 포함한다. shadcn CLI package version 갱신과 registry source diff는
별도 변경으로 유지한다. TypeScript는 tooling lane에 속하지만
[호환성 보고서](../apps/web/content/tech/docs/ko/fe/typescript-7-compatibility.mdx)의 재감사 없이 갱신하지 않는다.

1. package가 이미 catalog에 있으면 루트 `package.json#workspaces.catalog`의 버전만 변경한다.
2. 새 외부 직접 의존성은 catalog와 소비 workspace의 `package.json`에 추가한다.
3. 내부 package는 registry 버전 대신 `workspace:*`를 사용한다.
4. `trustedDependencies` 추가는 실제 install script가 필요한 native package에만 허용한다.
5. dependency lane, 현재 버전과 검토한 공식 release note를 변경 설명에 기록한다.
6. TypeScript update 후보는 tooling lane에 표시되며 호환성 보고서의 재감사 결과가 있을 때만
   적용한다.

`bun run deadcode`는 미사용 파일·의존성·catalog 항목, 미선언 의존성,
해석할 수 없는 catalog 참조, 중복 export를 검사한다.
catalog는 소비 workspace가 있는 항목만 유지한다. `knip.json`의 루트 의존성 예외는
CLI를 설치하는 `@jongminchung/generate-article-image-skill`이다. Excalidraw는 생성 script의
`import.meta.resolve`로 사용처를 명시한다. 새 예외는 실제 사용 경로를 확인하고 여기에
이유를 기록한다. 의존성 갱신 시 예외가 여전히 필요한지도 다시 확인한다.

Renovate PR도 같은 기준으로 manifest, lockfile, release note, peer 범위와 전체 gate를 직접
검토한다. 새 버전이 설치된다는 사실만으로 runtime·framework 호환성을 판단하지 않는다.

## 보안 점검

```sh
bun run audit
```

이 명령은 `bun audit --audit-level high`를 실행하며 registry 네트워크를
사용한다. 현재 별도의 scheduled security workflow는 없으므로 정기 점검과 릴리스 전에
수동 실행한다.

advisory가 발견되면 다음 순서로 처리한다.

1. 직접·전이 의존성과 실제 사용 경로를 확인한다.
2. upstream 수정 버전을 catalog 또는 `overrides`에 최소 범위로 반영한다.
3. lockfile diff에서 의도하지 않은 package 교체와 install script 변화를 확인한다.
4. 관련 앱의 build·E2E와 전체 `check:full`을 실행한다.
5. 임시 override라면 제거 조건과 upstream 버전을 변경 설명에 기록한다.

## 링크 점검

```sh
bun run links:check
```

이 명령은 PATH에서 Podman을 먼저 찾고, 없으면 Docker를 사용해
`docker.io/lycheeverse/lychee:0.24.2` image를 실행하고 저장소를 read-only로 mount한다.
둘 다 없으면 설치 안내와 함께 실패한다. 선택한 runtime의 실행 실패는 그대로 보고한다.
Markdown과 HTML의 로컬 링크·anchor만 검사하며 외부 URL에는 network request를 보내지 않는다.
image를 일시적으로 바꿔 검증할 때는 `LYCHEE_IMAGE` 환경 변수를 사용한다.
Web MDX의 app route는 기존 content validation과 build가 별도로 검증한다.

## 생성물 관리

| 대상                 | 원본                             | 갱신                                                             | 검증                           |
| -------------------- | -------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| Web 콘텐츠 원본      | `content/tech`, `content/invest` | MDX 직접 수정                                                    | Next.js build와 route contract |
| Fumadocs entry       | `source.config.ts`와 MDX 원본    | Web install·build lifecycle                                      | Web typecheck·build            |
| Excalidraw 정적 자산 | Excalidraw source asset          | Web `dev`·`build` lifecycle                                      | Web `build`                    |
| Playwright snapshot  | 렌더링 결과                      | `bun run --filter @jongminchung/web test:e2e --update-snapshots` | visual test와 diff 직접 검토   |

- `.source`는 Fumadocs가 생성하는 비커밋 산출물이므로 직접 수정하지 않음
  - 새 MDX 추가 후 `bun run --filter @jongminchung/web postinstall` 또는 Web `build`로 다시 생성함
- PlantUML은 Kroki GET URL만 빌드하므로 Web build가 Kroki 네트워크 상태에 의존하지 않음

## GitHub Actions

유지보수 관련 주요 workflow는 다음과 같다. 실제 목록과 실행 조건은 `.github/workflows`를 확인한다.

| Workflow           | Trigger                       | 역할                                                 | 주요 secret                    |
| ------------------ | ----------------------------- | ---------------------------------------------------- | ------------------------------ |
| `Publish Packages` | `workflow_dispatch`           | `ui`의 GitHub Packages `1.0.0` 교체                  | `GH_PAT`                       |
| `Waka Readme`      | 매일 `15:00 UTC`, 수동 실행   | README Waka 통계 구간 갱신                           | `WAKATIME_API_KEY`, `GH_TOKEN` |
| `Links`            | 문서 PR·`main` push           | Podman 우선·Docker 대체 Markdown·HTML 로컬 링크 검사 | 없음                           |
| `Web`              | PR·관련 `main` push·주간 예약 | Web 검사·브라우저 회귀, 주간 콘텐츠 근거 보고서      | 없음                           |

## 패키지 게시

`@jongminchung/ui`는 고정 `1.0.0` 정책을 사용한다.
이는 동일 version의 API·내용·integrity가 달라질 수 있는 mutable personal snapshot 채널이며
SemVer 호환성과 lockfile 재현성을 지원하지 않는다. 소비자는 교체된 snapshot을 적용할 때
`bun update --force <package>@1.0.0`으로 다시 해석하고 변경된 lockfile을 함께 반영한다.
UI는 Node.js 24 이상에서 동작하는 ESM 전용 패키지이며 공개 runtime API는 named
export만 제공한다. `package.json`에는 `type: "module"`, `engines.node: ">=24.0.0"`,
JavaScript entry point별 `import` 조건을 유지하고 CommonJS 산출물과 `require` 조건을 추가하지
않는다.

UI의 `build`는 공통 `tsconfig.base.json`의 strict 검사를 상속하고 패키지별
`tsconfig.build.json`에 선언·출력 옵션만 명시해 `tsc`로 ESM JavaScript와 declaration을
생성한다. CSS·JSON subpath는 tarball에 포함된 원본 자산을 직접 가리킨다. 번들링·축소·복수
모듈 형식이나 빌드 플러그인은 기본 배포 경계가 아니며, [ADR 0001](adr/0001-node-library-tsc-build.md)의
재도입 조건을 충족할 때만 다시 검토한다.

```sh
bun install --frozen-lockfile --ignore-scripts
bun run --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/ui test:coverage
bun run --filter @jongminchung/ui test:node
bun run --filter @jongminchung/ui publish:dry-run
```

dry-run의 포함 파일, ESM JavaScript·declaration, named export와 package export를 검토한 뒤
검증한 `main` ref에서 `Publish Packages` workflow를 수동 실행한다. UI를 Node
24·26에서 검사하고, 게시할 tarball을 만든 뒤 기존 `1.0.0`을 삭제하고 `npm publish`로
해당 archive를 게시한다. 게시 후 registry integrity와 소비자 import도 검증한다.
삭제 전 정상 archive를 보관하고
[게시·복구 절차](runbooks/release.md)에 따라 결과를 확인한다.

## 문서 유지보수

- 새 문서는 [문서 인덱스](README.md)에 연결한다.
- 완료 TODO는 [완료 기록 보관함](archive/README.md)에 보존하고 완료일을 추정하지 않는다.
- 이슈의 최초 문제·현재 구현·남은 작업을 구분한다. 구현 완료·반영 대기는 운영 확인 없이 완료로 바꾸지 않는다.
- 과거 명령·측정값·테스트 개수는 당시 기록으로 표시하고 현재 절차는 기여·유지보수 문서로 연결한다.
- 외부 직접 의존성 추가·삭제·버전 변경 시 manifest·catalog·lockfile과 공식 release note를 함께 검토한다.
- 공식 문서 전용 사이트를 우선하고 없으면 maintainer의 공식 저장소 README를 연결한다.
- 특정 버전 문서가 제공되면 현재 major와 맞는 페이지를 사용한다.
- redirect, 폐기된 문서, 저장소 이전 여부를 의존성 업데이트 시 다시 확인한다.
- 명령, port, workflow와 secret 이름은 설명보다 실제 manifest·config를 기준으로 검증한다.

## 콘텐츠 출처 응답 점검

`bun run --filter @jongminchung/web content:evidence -- --network`는 HEAD 응답을 분류한다.
2xx만 `ok`이며, 401·403은 `access-denied`, 405·501은 `method-not-supported`,
404·410은 `missing`, 408·429와 나머지 5xx는 `temporary-failure`,
3xx는 `redirect`, 그 밖의 오류 응답은 `http-error`다.
`missing`은 `review-required`, 그 외 비정상 응답은 `warning`으로 검토한다.
HEAD 미지원은 링크 삭제 근거가 아니므로 브라우저 또는 GET으로 확인한 뒤 판단한다.
네트워크 없이 실행한 `not-checked`는 출처 접근 성공을 뜻하지 않는다.
