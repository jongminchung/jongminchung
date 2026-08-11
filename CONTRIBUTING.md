# 기여 가이드

이 문서는 pnpm 모노레포의 공통 개발·검증 절차를 설명한다. Git Client의 Electron 실행,
fixture, 패키징과 릴리스 절차는 [Git Client 기여 가이드](apps/git-client/CONTRIBUTING.md)를
함께 따른다. `plugins/go-lsp`는 별도 빌드이므로 이 문서의 범위에 포함하지 않는다.

## 개발 환경

| 도구    | 버전·조건                                              | 기준 파일                               |
| ------- | ------------------------------------------------------ | --------------------------------------- |
| Node.js | `26.5.0`                                               | `.node-version`, `package.json#engines` |
| pnpm    | `11.15.1`                                              | `package.json#packageManager`           |
| Git     | 일반 개발에 필요, Git Client는 `2.39+`                 | 시스템 설치                             |
| macOS   | Git Client의 패키지·Electron 검증은 Apple Silicon 필요 | 앱 지원 정책                            |

저장소 루트에서 버전을 확인하고 잠금 파일을 변경하지 않는 설치를 수행한다.

```sh
node --version
pnpm --version
git --version
pnpm install --frozen-lockfile
```

의존성은 workspace별로 따로 설치하지 않는다. 모든 명령은 별도 안내가 없으면 저장소
루트에서 실행하고, package script에는 항상 `run`을 명시한다.

## Workspace 구조

| Workspace                  | 역할                                        | 주요 개발 명령                                         |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `apps/engineering-docs`    | Next.js·MDX 기술 문서 앱                    | `pnpm run dev:engineering-docs`                        |
| `apps/readme`              | 개인 README Next.js 앱                      | `pnpm run dev:readme`                                  |
| `apps/git-client`          | macOS Electron Git 클라이언트               | `pnpm --filter @jongminchung/git-client run dev`       |
| `packages/ui`              | 공개 UI primitive·기본 theme·semantic token | `pnpm --filter @jongminchung/ui run build`             |
| `packages/icon`            | 아이콘 원본과 앱별 생성 자산                | `pnpm run icon:check`                                  |
| `packages/remark-plantuml` | Markdown PlantUML 변환 패키지               | `pnpm --filter @jongminchung/remark-plantuml run test` |
| `packages/tooling`         | Oxc 설정과 workspace package map            | `pnpm --filter @jongminchung/tooling run test`         |

공용 UI의 소유권, token과 component 추가 규칙은 [디자인 시스템](DESIGN_SYSTEM.md)을
따른다. 앱별 product component를 `packages/ui`로 옮기거나 앱에서 공용 primitive를 복제하지
않는다.

## 개발과 검증

변경 중에는 가장 가까운 workspace 검사를 먼저 실행한다.

```sh
pnpm --filter @jongminchung/engineering-docs run typecheck
pnpm --filter @jongminchung/readme run typecheck
pnpm --filter @jongminchung/git-client run qa:compact
pnpm --filter @jongminchung/ui run build
pnpm --filter @jongminchung/ui run test
```

루트 검증 명령의 범위는 다음과 같다.

| 명령                            | 검증 범위                                             |
| ------------------------------- | ----------------------------------------------------- |
| `pnpm run fmt:check`            | Oxfmt 형식 검사                                       |
| `pnpm run lint`                 | Oxlint 정적 분석                                      |
| `pnpm run typecheck`            | 루트와 모든 workspace TypeScript 검사                 |
| `pnpm run test`                 | Vitest와 Git Client script 테스트                     |
| `pnpm run check`                | format, lint, Nx graph, typecheck, unit·script 테스트 |
| `pnpm run check:full`           | `check`, E2E typecheck, build, core E2E               |
| `pnpm run check:full:electron`  | `check:full`과 패키지 Electron E2E                    |
| `pnpm run check:full:materials` | `check:full`과 모든 material E2E                      |

변경 유형별 최소 검증은 다음을 기준으로 한다.

| 변경 유형                              | 최소 검증                                                               |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Markdown·설정 문서                     | `fmt:check`, `lint`, 상대 링크와 명령 직접 확인                         |
| React·CSS·공용 UI                      | 해당 workspace typecheck·test, 관련 Playwright, `DESIGN_SYSTEM.md` 계약 |
| Next.js route·MDX 파이프라인           | 해당 앱 typecheck·test·build, core E2E                                  |
| 공용 패키지                            | 해당 패키지 typecheck·test·build, 소비 앱 typecheck                     |
| 아이콘                                 | `icon:generate`, `icon:check`, 관련 visual snapshot 확인                |
| Git Client renderer                    | `qa:compact`                                                            |
| Git Client main·preload·utility·native | 전용 가이드의 package verify·smoke·Electron E2E                         |
| 릴리스·배포                            | `check:full`과 해당 dry-run·릴리스 가이드                               |

## 생성물과 외부 소스

생성된 파일을 직접 고치지 않고 소스와 생성 명령을 함께 사용한다.

### 아이콘

`packages/icon/src/index.ts`가 아이콘 색상과 도형의 단일 원본이다. 앱의 `app/icon.svg`는
직접 편집하지 않는다.

```sh
pnpm run icon:generate
pnpm run icon:check
```

### Engineering Docs 콘텐츠

콘텐츠 manifest, loader와 검색 데이터는 MDX 소스에서 생성한다.

```sh
pnpm --filter @jongminchung/engineering-docs run content:build
pnpm --filter @jongminchung/engineering-docs run content:check
```

`apps/engineering-docs/components/materials/topics`는 sibling `kciter.github.io`의 vendor
snapshot이다. 파일을 직접 고치지 말고
[material 소유권 문서](apps/engineering-docs/components/materials/README.md)의 importer를
사용한 뒤 다음 검사를 실행한다.

```sh
pnpm --filter @jongminchung/engineering-docs run materials:build
pnpm --filter @jongminchung/engineering-docs run materials:check
```

Excalidraw 정적 자산은 전용 준비·검사 명령으로 갱신한다.

```sh
pnpm --filter @jongminchung/engineering-docs run excalidraw:assets
pnpm --filter @jongminchung/engineering-docs run excalidraw:check
```

Playwright snapshot은 의도적인 시각 변경만 갱신한다. 갱신 후 새 기준 이미지와 diff를 직접
검토하고 단순히 실패를 없애기 위해 snapshot을 덮어쓰지 않는다.

## 의존성 변경

공통 버전은 `pnpm-workspace.yaml`의 catalog에서 고정하고 workspace manifest는 `catalog:`을
사용한다. 내부 패키지는 `workspace:*`로 연결한다.

```sh
pnpm run deps:check
pnpm run deps:update
pnpm install
```

의존성을 추가·삭제하거나 버전을 변경할 때는 다음을 함께 검토한다.

1. 해당 `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`의 일관성
2. native install script가 필요하면 `allowBuilds`에 최소 범위만 추가했는지
3. [기술 스택과 공식 문서](docs/technology-stack.md)의 패키지·버전·링크
4. TypeScript 변경이면 [TypeScript 7 호환성 보고서](docs/typescript-7-compatibility-report.md)의 현재 정책
5. 관련 workspace 검사와 `pnpm run check:full`

`pnpm run audit:prod`는 registry advisory database를 조회하므로 네트워크가 필요하다. 기본
`check`에는 포함되지 않으며 정기 점검과 릴리스 전에 수동으로 실행한다.

## Secret과 보안

- token, 인증서, keychain password와 `.npmrc` 인증값을 커밋하지 않는다.
- GitHub Actions secret은 workflow에 정의된 이름으로만 주입하고 문서에는 값이나 예시
  token을 기록하지 않는다.
- `GH_PAT`는 package 게시와 Git Client release에만 사용한다.
- Apple 서명·공증 secret은 Git Client production release job에서만 사용한다.
- 보안 문제를 수정할 때 renderer·preload·main 등 신뢰 경계를 우회하는 API를 추가하지 않는다.

현재 secret 목록과 workflow별 용도는 [유지보수 가이드](docs/maintenance.md)에 정리되어 있다.

## 게시와 릴리스

공개 패키지는 제출 전에 pack 결과를 확인한다.

- `packages/*/src`의 공개 API는 named export만 사용한다.
- 공개 Node.js 패키지는 `engines.node: ">=24.0.0"`과 `type: "module"`을 유지한다.
- JavaScript entry point는 `exports`의 `import` 조건으로만 공개한다.
- CommonJS build, `require` 조건, JavaScript `default` fallback을 추가하지 않는다.
- 공개 패키지는 공통 `tsconfig.library.json`과 패키지별 `tsconfig.build.json`으로 ESM
  JavaScript와 declaration을 직접 생성한다.
- 번들러 재도입 조건은 [ADR 0002](docs/adr/0002-node-library-tsc-build.md)를 따른다.
- `packages/icon`, `packages/ui`는 private source package이므로 registry에 게시하지 않는다.

```sh
pnpm run check
pnpm run publish:dry-run
```

`@jongminchung/remark-plantuml`과 `@jongminchung/tooling`은 GitHub Actions의 수동
`Publish Packages` workflow가 GitHub Packages의 고정 `1.0.0`을 교체한다. Git Client는
[GitHub Release 배포 가이드](apps/git-client/docs/releases.md)를 따른다.

## 제출 체크리스트

- 기존 사용자 변경과 관련 없는 파일을 되돌리거나 포함하지 않았다.
- 변경 범위에 맞는 최소 검사와 필요한 전체 gate를 실행했다.
- 생성물은 원본과 생성 명령을 통해 갱신했고 diff를 검토했다.
- manifest 변경과 lockfile, 기술 스택 문서가 일치한다.
- 새 공식 문서 링크와 저장소 내부 상대 링크가 유효하다.
- secret, 개인 경로, 임시 fixture와 build artifact가 포함되지 않았다.
- `git diff --check`가 통과한다.
