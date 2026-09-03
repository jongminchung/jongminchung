# 기여 가이드

이 문서는 Bun 모노레포의 공통 개발·검증 절차를 설명한다. `plugins/go-lsp`는 별도
빌드이므로 이 문서의 범위에 포함하지 않는다.

## 개발 환경

| 도구    | 버전·조건                        | 기준 파일                      |
| ------- | -------------------------------- | ------------------------------ |
| Bun     | `1.4.0`                          | `.bun-version`, `package.json` |
| Node.js | 공개 패키지 검증용 `24.0.0` 이상 | `.node-version`, `packages/*`  |
| Git     | 일반 개발에 필요                 | 시스템 설치                    |

저장소 루트에서 버전을 확인하고 잠금 파일을 변경하지 않는 설치를 수행한다.

```sh
bun --version
node --version
git --version
bun install --frozen-lockfile
```

의존성은 workspace별로 따로 설치하지 않는다.

## Workspace 구조

| Workspace          | 역할                                        | 주요 개발 명령                                |
| ------------------ | ------------------------------------------- | --------------------------------------------- |
| `apps/web`         | 프로필·기술·투자 멀티도메인 Next.js 앱      | `bun run --filter @jongminchung/web dev`      |
| `packages/ui`      | 공개 UI primitive·기본 theme·semantic token | `bun run --filter @jongminchung/ui build`     |
| `packages/tooling` | Oxc 공용 설정                               | `bun run --filter @jongminchung/tooling test` |

공용 UI의 소유권, token과 component 추가 규칙은 [디자인 시스템](../DESIGN_SYSTEM.md)을
따른다. 앱별 product component를 `packages/ui`로 옮기거나 앱에서 공용 primitive를 복제하지
않는다.

## 개발과 검증

변경 중에는 가장 가까운 workspace 검사를 먼저 실행한다.

```sh
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/ui build
bun run --filter @jongminchung/ui test
```

루트 검증 명령의 범위는 다음과 같다.

| 명령                  | 검증 범위                                            |
| --------------------- | ---------------------------------------------------- |
| `bun run fmt:check`   | Oxfmt 형식 검사                                      |
| `bun run lint`        | Oxlint 정적 분석                                     |
| `bun run typecheck`   | 루트와 모든 workspace TypeScript 검사                |
| `bun run deadcode`    | 미사용 파일과 중복 export 검사                       |
| `bun run links:check` | Docker 기반 Markdown·HTML 로컬 링크 검사             |
| `bun run test`        | Bun Unit·Integration과 Node package runtime smoke    |
| `bun run test:e2e`    | build 후 앱별 Playwright E2E                         |
| `bun run check`       | format, lint, typecheck, deadcode와 전체 로컬 테스트 |
| `bun run check:full`  | `check`, E2E typecheck, 단일 build, core E2E         |

테스트 계약은 Bun 내장 runner의 Unit·Integration, 공개 package의 Node runtime smoke,
build된 앱을 검증하는 Playwright E2E로 구분한다. workspace별 Bun coverage 결과는
`coverage/{web,tooling,ui}`에서 검토한다.

```sh
bun run test
bun run --filter @jongminchung/web test
bun run --filter @jongminchung/ui test
bun run --filter @jongminchung/tooling test
bun run test:e2e
```

변경 유형별 최소 검증은 다음을 기준으로 한다.

| 변경 유형                    | 최소 검증                                                               |
| ---------------------------- | ----------------------------------------------------------------------- |
| Markdown·설정 문서           | `fmt:check`, `links:check`, 명령 직접 확인                              |
| React·CSS·공용 UI            | 해당 workspace typecheck·test, 관련 Playwright, `DESIGN_SYSTEM.md` 계약 |
| Next.js route·MDX 파이프라인 | 해당 앱 typecheck·test·build, core E2E                                  |
| 공용 패키지                  | 해당 패키지 typecheck·test·build, 소비 앱 typecheck                     |
| 웹 브랜드·파비콘             | Web typecheck·build, 관련 visual snapshot 확인                          |
| 릴리스·배포                  | `check:full`과 해당 dry-run·릴리스 가이드                               |

## 생성물과 외부 소스

Web 콘텐츠는 Next.js Server Component와 route handler가 MDX 원본에서 직접 읽는다.

### Web 콘텐츠

기술 문서와 투자 노트는 `content/`에서 바로 수정한다. 개발 서버와 production build는
별도 manifest·loader·검색 JSON 생성 명령 없이 해당 원본을 사용한다.

Excalidraw 정적 자산은 개발 서버와 production build의 lifecycle에서 준비한다. production build는
자산과 inline scene도 함께 검증한다.

```sh
bun run --filter @jongminchung/web dev
bun run --filter @jongminchung/web build
```

Web 개발 서버는 host 기반 proxy를 항상 사용한다. 기본 `dev`는 Home을 열고, 특정 사이트만
`localhost`에서 개발할 때는 사이트 선택 명령을 사용한다.

```sh
bun run --filter @jongminchung/web dev:home
bun run --filter @jongminchung/web dev:tech
bun run --filter @jongminchung/web dev:invest
```

각 명령은 `http://localhost:3000/en`을 선택한 사이트로 연결한다. production host와
`*.jamie.localhost`의 명시적 사이트 매핑은 이 개발 전용 선택값의 영향을 받지 않는다.

브라우저 외부의 Linux CLI가 `*.localhost`를 해석하지 못할 때만 다음 항목을 `/etc/hosts`에
선택적으로 추가한다. [RFC 6761의 localhost 규정](https://www.rfc-editor.org/rfc/rfc6761.html#section-6.3)은
하위 이름도 loopback으로 취급하지만, [Node.js `dns.lookup()`](https://nodejs.org/api/dns.html#dnslookuphostname-options-callback)은
OS 이름 해석 기능을 사용하므로 Linux 구성에 따라 결과가 다를 수 있다. 자동 테스트는 이 설정에
의존하지 않는다.

```text
127.0.0.1 jamie.localhost
127.0.0.1 tech.jamie.localhost
127.0.0.1 invest.jamie.localhost
```

Playwright snapshot은 의도적인 시각 변경만 갱신한다. 갱신 후 새 기준 이미지와 diff를 직접
검토하고 단순히 실패를 없애기 위해 snapshot을 덮어쓰지 않는다.

## 의존성 변경

공통 버전은 루트 `package.json#workspaces.catalog`에서 고정하고 workspace manifest는 `catalog:`을
사용한다. 내부 패키지는 `workspace:*`로 연결한다.

```sh
bun outdated --recursive
# 루트 catalog 또는 해당 package.json의 대상 버전 변경
bun install
```

의존성을 추가·삭제하거나 버전을 변경할 때는 다음을 함께 검토한다.

1. 해당 `package.json`, `bunfig.toml`, `bun.lock`의 일관성
2. native install script가 필요하면 `trustedDependencies`에 최소 범위만 추가했는지
3. dependency lane, 현재 버전과 검토한 공식 release note
4. TypeScript 변경이면 [TypeScript 7 호환성 보고서](../apps/web/content/tech/docs/ko/fe/typescript-7-compatibility.mdx)의 현재 정책
5. 관련 workspace 검사와 `bun run check:full`

`bun run audit`는 registry advisory database를 조회하므로 네트워크가 필요하다. 기본
`check`에는 포함되지 않으며 정기 점검과 릴리스 전에 수동으로 실행한다.

## Secret과 보안

- token, 인증서, keychain password와 `.npmrc` 인증값을 커밋하지 않는다.
- GitHub Actions secret은 workflow에 정의된 이름으로만 주입하고 문서에는 값이나 예시
  token을 기록하지 않는다.
- `GH_PAT`는 package 게시에만 사용한다.

현재 secret 목록과 workflow별 용도는 [유지보수 가이드](maintenance.md)에 정리되어 있다.

## 게시와 릴리스

공용 shadcn primitive는 `packages/ui/components.json`을 canonical 설정으로 사용하며 다음 순서로
검토한다. `apps/web/components.json`은 consumer alias 확인용이며 공용 primitive 생성·갱신에는
사용하지 않는다.

```sh
bunx --bun shadcn add <component> --dry-run -c packages/ui
bunx --bun shadcn add <component> --diff -c packages/ui
bunx --bun shadcn add <component> -c packages/ui
```

공개 패키지는 제출 전에 pack 결과를 확인한다.

- `packages/*/src`의 공개 API는 named export만 사용한다.
- 공개 Node.js 패키지는 `engines.node: ">=24.0.0"`과 `type: "module"`을 유지한다.
- JavaScript entry point는 `exports`의 `import` 조건으로만 공개한다.
- CommonJS build, `require` 조건, JavaScript `default` fallback을 추가하지 않는다.
- 공개 패키지는 공통 `tsconfig.base.json`의 strict 검사를 상속하고 패키지별
  `tsconfig.build.json`에 emit 옵션만 명시해 ESM JavaScript와 declaration을 직접 생성한다.
- 번들러 재도입 조건은 [ADR 0001](adr/0001-node-library-tsc-build.md)을 따른다.

```sh
bun install --filter @jongminchung/tooling --filter @jongminchung/ui --frozen-lockfile --ignore-scripts
bun run --filter @jongminchung/tooling --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/tooling --filter @jongminchung/ui test
bun run --filter @jongminchung/tooling --filter @jongminchung/ui publish:dry-run
```

`@jongminchung/tooling`, `@jongminchung/ui`는 GitHub Actions의 수동
`Publish Packages` workflow가 GitHub Packages의 고정 `1.0.0` snapshot을 교체한다. 동일
version의 API·내용·integrity가 바뀔 수 있으므로 SemVer 호환성과 lockfile 재현성을 보장하지
않는다. workflow는 publish package만 설치·typecheck·test한 뒤, 기존 `1.0.0`을 삭제하고 두
package를 병렬 게시한다.

## 제출 체크리스트

- 기존 사용자 변경과 관련 없는 파일을 되돌리거나 포함하지 않았다.
- 변경 범위에 맞는 최소 검사와 필요한 전체 gate를 실행했다.
- 생성물은 원본과 생성 명령을 통해 갱신했고 diff를 검토했다.
- manifest 변경과 lockfile, 기술 스택 문서가 일치한다.
- 새 공식 문서 링크와 저장소 내부 상대 링크가 유효하다.
- secret, 개인 경로, 임시 fixture와 build artifact가 포함되지 않았다.
- `git diff --check`가 통과한다.
