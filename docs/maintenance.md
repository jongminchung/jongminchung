# 유지보수 가이드

이 문서는 pnpm 모노레포를 직접 운영할 때 반복되는 점검과 배포 절차를 정리한다.
일반 개발 규칙은 [기여 가이드](../CONTRIBUTING.md), Electron 고유 절차는
[Git Client 문서](../apps/git-client/docs/README.md)를 따른다. `plugins/go-lsp`는 이 문서의
범위에서 제외한다.

## 기본 점검

| 시점           | 실행·확인 항목                                                     |
| -------------- | ------------------------------------------------------------------ |
| 변경 시작 전   | `git status --short --branch`, Node·pnpm 버전, 관련 workspace 문서 |
| 일반 변경 후   | 관련 typecheck·test, `pnpm run check`, `git diff --check`          |
| UI·E2E 변경 후 | 관련 Playwright와 screenshot·trace·snapshot diff                   |
| 의존성 변경 후 | manifest·catalog·lockfile·기술 스택 문서, `check:full`             |
| 릴리스 전      | `check:full`, `audit:prod`, 해당 package·app dry-run               |

`pnpm run check`는 네트워크 없이 재현 가능한 기본 gate다. Next.js build와 core E2E까지
포함하려면 `pnpm run check:full`을 사용한다. Electron 전체 시나리오는
`check:full:electron`으로 분리되어 있다.

## 의존성 업데이트

`renovate.json`은 pnpm과 GitHub Actions를 관리한다. npm 업데이트는 framework, UI,
desktop, test, tooling lane별 PR로 묶고, major 업데이트는 Dependency Dashboard 승인이 있어야
열리며, lockfile maintenance는 Asia/Seoul 기준 월요일 오전 4시 이전에 예약되어 있다.

수동 점검과 업데이트는 다음 순서로 진행한다.

```sh
pnpm run deps:inventory
pnpm run deps:check -- <framework|ui|desktop|test|tooling>
pnpm run deps:update -- <framework|ui|desktop|test|tooling>
git diff -- pnpm-workspace.yaml pnpm-lock.yaml package.json apps packages
```

`deps:update`는 선택한 lane의 직접 dependency만 manifest와 catalog에서 변경하고 `pnpm install`을
실행한다. 전이 dependency 변경은 허용하지만 한 PR의 직접 dependency 목적은 한 lane으로
유지한다. 여러 lane을 결합해야 하면 결합 이유와 lane별 rollback 단위를 변경 설명에 기록한다.

| Lane      | 대표 범위                                | 최소 검증                                                  |
| --------- | ---------------------------------------- | ---------------------------------------------------------- |
| framework | React, Next.js, MDX runtime              | 두 앱 build, Web E2E                                       |
| UI        | Tailwind, Base UI, shadcn, UI dependency | UI test, 두 앱 build, 영향받는 interaction test            |
| desktop   | Electron, Forge, native·desktop runtime  | Git Client typecheck·test, Electron package·smoke          |
| test      | Vitest, Playwright, axe, coverage        | reporter·fixture test, 대표 unit·integration·browser suite |
| tooling   | TypeScript, Oxc, Vite, content tooling   | `pnpm run check`, 영향받는 package build                   |

dependency PR 설명에는 **lane**, 주요 release note와 migration 유무, 실행한 최소 검증,
major update의 rollback 조건을 포함한다. shadcn CLI package version 갱신과 registry source diff는
별도 변경으로 유지한다. TypeScript는 tooling lane에 속하지만
[호환성 보고서](typescript-7-compatibility-report.md)의 재감사 없이 갱신하지 않는다.

1. package가 이미 catalog에 있으면 `pnpm-workspace.yaml`의 버전만 변경한다.
2. 새 외부 직접 의존성은 catalog와 소비 workspace의 `package.json`에 추가한다.
3. 내부 package는 registry 버전 대신 `workspace:*`를 사용한다.
4. `allowBuilds` 추가는 실제 install script가 필요한 native package에만 허용한다.
5. [기술 스택 문서](technology-stack.md)의 버전, 사용 위치와 공식 문서를 수동 갱신한다.
6. TypeScript update 후보는 tooling lane에 표시되며 호환성 보고서의 재감사 결과가 있을 때만
   적용한다.

Renovate PR도 같은 기준으로 manifest, lockfile, release note, peer 범위와 전체 gate를 직접
검토한다. 새 버전이 설치된다는 사실만으로 runtime·Electron packaging 호환성을 판단하지
않는다.

## 보안 점검

```sh
pnpm run audit:prod
```

이 명령은 production dependency의 high 이상 advisory에서 실패하며 registry 네트워크를
사용한다. 현재 별도의 scheduled security workflow는 없으므로 정기 점검과 릴리스 전에
수동 실행한다.

advisory가 발견되면 다음 순서로 처리한다.

1. 직접·전이 의존성과 실제 사용 경로를 확인한다.
2. upstream 수정 버전을 catalog 또는 `overrides`에 최소 범위로 반영한다.
3. lockfile diff에서 의도하지 않은 package 교체와 install script 변화를 확인한다.
4. 관련 앱의 build·E2E와 전체 `check:full`을 실행한다.
5. 임시 override라면 제거 조건과 upstream 버전을 변경 설명에 기록한다.

## 생성물 관리

| 대상                 | 원본                             | 갱신                             | 검증                           |
| -------------------- | -------------------------------- | -------------------------------- | ------------------------------ |
| Web 콘텐츠 원본      | `content/tech`, `content/invest` | MDX 직접 수정                    | Next.js build와 route contract |
| Fumadocs entry       | `source.config.ts`와 MDX 원본    | Web install·build lifecycle      | Web typecheck·build            |
| Excalidraw 정적 자산 | Excalidraw source asset          | Web `dev`·`build` lifecycle      | Web `build`                    |
| Playwright snapshot  | 렌더링 결과                      | `test:e2e -- --update-snapshots` | visual test와 diff 직접 검토   |

- `.source`는 Fumadocs가 생성하는 비커밋 산출물이므로 직접 수정하지 않음
  - 새 MDX 추가 후 `pnpm --filter @jongminchung/web exec fumadocs-mdx` 또는 Web `build`로 다시 생성함
- PlantUML은 Kroki GET URL만 빌드하므로 Web build가 Kroki 네트워크 상태에 의존하지 않음

## GitHub Actions

현재 저장소에는 세 workflow가 있다.

| Workflow           | Trigger                     | 역할                                                   | 주요 secret                      |
| ------------------ | --------------------------- | ------------------------------------------------------ | -------------------------------- |
| `Publish Packages` | `workflow_dispatch`         | 검사 후 `tooling`, `ui`의 GitHub Packages `1.0.0` 교체 | `GH_PAT`                         |
| `Git Client`       | `workflow_dispatch`         | `main` 검증, macOS ARM64 서명·공증·GitHub Release      | `GH_PAT`, Apple 서명·공증 secret |
| `Waka Readme`      | 매일 `15:00 UTC`, 수동 실행 | README Waka 통계 구간 갱신                             | `WAKATIME_API_KEY`, `GH_TOKEN`   |

Git Client workflow가 사용하는 Apple secret 이름은 다음과 같다.

- `GIT_CLIENT_APPLE_APP_SPECIFIC_PASSWORD`
- `GIT_CLIENT_APPLE_ID`
- `GIT_CLIENT_APPLE_TEAM_ID`
- `GIT_CLIENT_CODESIGN_CERTIFICATE_BASE64`
- `GIT_CLIENT_CODESIGN_CERTIFICATE_PASSWORD`
- `GIT_CLIENT_CODESIGN_IDENTITY`

값은 로컬 파일, shell history, 문서나 workflow source에 기록하지 않는다. secret rotation 후에는
GitHub repository의 등록 상태를 확인하고 다음 production release의 서명·공증과 게시 후 검증을
생략하지 않는다. local ad-hoc artifact는 production secret의 유효성을 증명하지 않는다.

## 패키지 게시

`@jongminchung/tooling`, `@jongminchung/ui`는 고정 `1.0.0` 정책을 사용한다.
이는 동일 version의 API·내용·integrity가 달라질 수 있는 mutable personal snapshot 채널이며
SemVer 호환성과 lockfile 재현성을 지원하지 않는다. 소비자는 교체된 snapshot을 적용할 때
`pnpm update --force <package>@1.0.0`으로 다시 해석하고 변경된 lockfile을 함께 반영한다.
두 패키지는 Node.js 24 이상에서 동작하는 ESM 전용 패키지이며 공개 runtime API는 named
export만 제공한다. `package.json`에는 `type: "module"`, `engines.node: ">=24.0.0"`,
JavaScript entry point별 `import` 조건을 유지하고 CommonJS 산출물과 `require` 조건을 추가하지
않는다.

두 패키지의 `build`는 공통 `tsconfig.base.json`의 strict 검사를 상속하고 패키지별
`tsconfig.build.json`에 선언·출력 옵션만 명시해 `tsc`로 ESM JavaScript와 declaration을
생성한다. CSS·JSON subpath는 tarball에 포함된 원본 자산을 직접 가리킨다. 번들링·축소·복수
모듈 형식이나 빌드 플러그인은 기본 배포 경계가 아니며, [ADR 0002](adr/0002-node-library-tsc-build.md)의
재도입 조건을 충족할 때만 다시 검토한다.

```sh
pnpm --filter @jongminchung/tooling --filter @jongminchung/ui install --frozen-lockfile --ignore-scripts
pnpm --filter @jongminchung/tooling --filter @jongminchung/ui run typecheck
pnpm --filter @jongminchung/tooling --filter @jongminchung/ui run test
pnpm run publish:dry-run
```

dry-run의 포함 파일, ESM JavaScript·declaration, named export와 package export를 검토한 뒤
`main`에서 `Publish Packages` workflow를 수동 실행한다. workflow는 `tooling`과 `ui`만 설치·
typecheck·test하여 Git Client와 Web의 native 의존성을 배포 범위에서 제외한다. 두 package별 기존
`1.0.0`을 병렬 삭제한 뒤, 두 package를 `pnpm publish`로 병렬 게시한다.

## Git Client 릴리스

Git Client는 Developer ID 서명과 Apple notarization을 거친 macOS ARM64 DMG를 수동
배포한다. 고정 version·tag, ad-hoc 검증, checksum, provenance와 게시 후 확인은
[GitHub Release 배포 가이드](../apps/git-client/docs/releases.md)를 단일 기준으로 사용한다.

일반 유지보수 문서에 인증서 설치나 production 명령을 복제하지 않는다. 릴리스 정책이
바뀌면 전용 가이드, workflow와 package script를 같은 변경에서 갱신한다.

## 문서 유지보수

- 새 문서는 [문서 인덱스](README.md)에 연결한다.
- 외부 직접 의존성 추가·삭제·버전 변경 시 [기술 스택](technology-stack.md)을 수동 갱신한다.
- 공식 문서 전용 사이트를 우선하고 없으면 maintainer의 공식 저장소 README를 연결한다.
- 특정 버전 문서가 제공되면 현재 major와 맞는 페이지를 사용한다.
- redirect, 폐기된 문서, 저장소 이전 여부를 의존성 업데이트 시 다시 확인한다.
- 명령, port, workflow와 secret 이름은 설명보다 실제 manifest·config를 기준으로 검증한다.
