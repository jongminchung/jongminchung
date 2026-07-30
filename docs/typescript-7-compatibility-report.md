# TypeScript 7 호환성 감사 보고서

## 결론

**단일 TypeScript 7 구성은 NO-GO다.**

TypeScript 7.0.2의 CLI는 이 저장소의 소스 타입 검사와 일부 빌드에서 정상 동작하지만,
TypeScript 7.0은 안정적인 Compiler API를 제공하지 않는다. 현재 루트의
`typescript@7.0.2`를 읽는 Nx 프로젝트 그래프는 실제로 실패하며, Next.js 16.2.10과
`engineering-docs`의 콘텐츠 검사도 TypeScript 6 Compiler API에 의존한다.

따라서 모든 workspace의 `typescript`를 7.0.2로 통일하면 안 된다. 후속 변경을 진행하려면
TypeScript 7 CLI와 TypeScript 6 API를 분리하는 공식 듀얼 컴파일러 구성을 먼저 도입하고,
Next.js·MDX workspace는 TypeScript 6을 유지해야 한다.

## 감사 기준

| 항목                 | 값                                                                |
| -------------------- | ----------------------------------------------------------------- |
| 검증일               | 2026-07-30                                                        |
| 기준 커밋            | `85ed9ae85cd9`                                                    |
| Node.js              | `26.5.0`                                                          |
| pnpm                 | `11.15.1`                                                         |
| 목표 컴파일러        | TypeScript `7.0.2`                                                |
| 앱 기준선            | TypeScript `6.0.3`                                                |
| 듀얼 구성 API 패키지 | `@typescript/typescript6@6.0.2` (`tsc6`과 API는 `6.0.3`으로 보고) |
| workspace            | 8개                                                               |
| 직접 외부 의존성     | 중복 제거 78개                                                    |
| 설치 트리            | 133개 패키지                                                      |

현재 구성은 이미 혼합 상태다.

- 루트 catalog, `git-client`, `icon`, `remark-plantuml`, `tooling`: TypeScript `7.0.2`
- `engineering-docs`, `readme`: TypeScript `6.0.3`
- `engineering-docs/scripts/build-content.ts`: `typescript`를 import해 Compiler API 사용
- Git Client 릴리스 흐름: Nx 프로젝트 그래프 사용

## 근거와 판정 규칙

### 공식·패키지 근거

- **O1**: [TypeScript 7.0 공식 발표](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) —
  7.0에는 안정적인 API가 없고 MDX 같은 embedded-language workflow는 TypeScript 6을
  유지해야 한다.
- **O2**: [Nx TypeScript 지원 범위](https://nx.dev/docs/technologies/typescript/introduction),
  [TypeScript 6/7 병행 절차](https://nx.dev/docs/kb/typescript-7) — Nx 23은 7.0 CLI를
  사용할 수 있지만 Compiler API 소비자를 위해 TypeScript 6 alias가 필요하다.
- **O3**: [Next.js 16.2.10 TypeScript 검사](https://github.com/vercel/next.js/blob/v16.2.10/packages/next/src/lib/verify-typescript-setup.ts),
  [runTypeCheck 구현](https://github.com/vercel/next.js/blob/v16.2.10/packages/next/src/lib/typescript/runTypeCheck.ts) —
  `typescript/lib/typescript.js`, `createProgram`, `getPreEmitDiagnostics` 등 기존 API를 사용한다.
- **P1**: 설치된 `tsdown@0.22.12`의 peer 범위는
  `^5.0.0 || ^6.0.0 || ^7.0.0`, 전이 의존성 `rolldown-plugin-dts@0.27.11`은
  `^5.0.0 || ^6.0.0 || ~7.0.0`이다.

### 로컬 근거

- **L1**: TypeScript 7.0.2 바이너리로 8개 tsconfig를 `--noEmit` 검사 — 모두 통과.
  단, `engineering-docs`의 `typescript` import는 현재 로컬 TypeScript 6 패키지로 해석된다.
- **L2**: 현재 혼합 구성의 `pnpm typecheck` — 통과.
- **L3**: `tooling`, `remark-plantuml`, Git Client Vite 빌드와 Electron Forge arm64 package 검증 —
  TypeScript 7 구성에서 통과.
- **L4**: 두 Next.js 앱의 직접 `next build` — 로컬 TypeScript 6.0.3에서 통과.
- **L5**: 단일 TypeScript 7 격리 구성 — Nx, `engineering-docs` 타입 검사, Next.js 타입 검사 실패.
- **L6**: 듀얼 격리 구성 — `tsc` 7.0.2, TypeScript 6 API, Nx 프로젝트 7개 탐색,
  tsdown 패키지 빌드, Next.js 빌드 통과.
- **L7**: `skipLibCheck: false` 진단 — Electron Forge/Electron, Excalidraw/MDX,
  tsdown의 선택적 선언 경계에서 기존 오류 발견.
- **L8**: 전체 `pnpm check` — format, lint, typecheck까지 진행된 뒤 기존 테스트 10개 실패.

판정의 의미는 다음과 같다.

| 판정                 | 의미                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| 지원 확인            | 해당 버전의 공식 범위 또는 실제 사용 경계에서 TS 7 검증을 통과했다.              |
| 조건부 지원          | 듀얼 컴파일러, TypeScript 6 API 유지 또는 현재 설정 유지가 필요하다.             |
| 차단                 | 단일 TS 7 구성에서 실제 실패가 재현됐다.                                         |
| TypeScript 비결합    | Compiler API나 TypeScript peer에 결합하지 않는다. 런타임 호환성 보증과는 다르다. |
| 기준선 오류로 미확정 | 기존 선언·생성물 문제 때문에 TS 7 고유 회귀인지 분리할 수 없다.                  |

## 직접 의존성 78개 판정표

`workspace`는 `root`, `docs`, `git`, `readme`, `icon`, `remark`, `tooling`으로 줄여 쓴다.
공식 지원 선언이 없는 라이브러리는 로컬 컴파일이나 빌드 성공을 공식 보증으로 표현하지 않는다.

|   # | 패키지                                       | 버전         | workspace                              | 결합 유형               | 근거            | 판정                 | 후속 조건                                                |
| --: | -------------------------------------------- | ------------ | -------------------------------------- | ----------------------- | --------------- | -------------------- | -------------------------------------------------------- |
|   1 | `@axe-core/playwright`                       | 4.12.1       | docs, git, readme                      | 테스트 adapter          | L1              | TypeScript 비결합    | -                                                        |
|   2 | `@base-ui/react`                             | 1.6.0        | docs, git, readme                      | React 선언 소비         | L1              | 지원 확인            | 메이저 갱신 시 선언 재검사                               |
|   3 | `@codemirror/commands`                       | 6.10.4       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|   4 | `@codemirror/lang-css`                       | 6.3.1        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|   5 | `@codemirror/lang-html`                      | 6.4.11       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|   6 | `@codemirror/lang-java`                      | 6.0.2        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|   7 | `@codemirror/lang-javascript`                | 6.2.5        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|   8 | `@codemirror/lang-json`                      | 6.0.2        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|   9 | `@codemirror/lang-python`                    | 6.2.1        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  10 | `@codemirror/language`                       | 6.12.4       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  11 | `@codemirror/merge`                          | 6.12.2       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  12 | `@codemirror/search`                         | 6.7.1        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  13 | `@codemirror/state`                          | 6.7.1        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  14 | `@codemirror/view`                           | 6.43.6       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  15 | `@electron-forge/cli`                        | 7.11.2       | git                                    | 패키징 도구             | L3              | TypeScript 비결합    | Electron package/make 회귀 검사 유지                     |
|  16 | `@electron-forge/maker-dmg`                  | 7.11.2       | git                                    | DMG 패키징              | 설치 메타데이터 | TypeScript 비결합    | 실제 make·서명 검사는 릴리스에서 수행                    |
|  17 | `@electron-forge/plugin-auto-unpack-natives` | 7.11.2       | git                                    | native 패키징           | 설치 메타데이터 | TypeScript 비결합    | Electron package 검사 유지                               |
|  18 | `@electron-forge/plugin-fuses`               | 7.11.2       | git                                    | Electron 설정           | 설치 메타데이터 | TypeScript 비결합    | Electron package 검사 유지                               |
|  19 | `@electron-forge/plugin-vite`                | 7.11.2       | git                                    | Vite/Forge 선언         | L3, L7          | 기준선 오류로 미확정 | `NewCtx` 선언 오류 해소 후 `skipLibCheck: false` 재검사  |
|  20 | `@electron-forge/shared-types`               | 7.11.2       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  21 | `@electron/fuses`                            | 2.1.3        | git                                    | Electron 설정           | 설치 메타데이터 | TypeScript 비결합    | package 검증 유지                                        |
|  22 | `@electron/rebuild`                          | 4.2.0        | git                                    | native rebuild          | 설치 메타데이터 | TypeScript 비결합    | Node/Electron ABI 변경 시 재검사                         |
|  23 | `@excalidraw/excalidraw`                     | 0.18.1       | docs                                   | 복합 선언 소비          | L1, L7          | 기준선 오류로 미확정 | 누락된 전이 선언과 exports 문제 해소 후 재검사           |
|  24 | `@mdx-js/loader`                             | 3.1.1        | docs                                   | embedded language       | O1, L4          | 조건부 지원          | TypeScript 6 유지; TS 7 API 지원 발표 후 재검사          |
|  25 | `@mdx-js/react`                              | 3.1.1        | docs                                   | MDX/React 선언          | O1, L4          | 조건부 지원          | TypeScript 6 유지; MDX 공식 지원 후 재검사               |
|  26 | `@next/mdx`                                  | 16.2.10      | docs                                   | Next.js/MDX 통합        | O1, O3, L5      | 차단                 | Next.js가 TS 7 API 또는 외부 CLI 검사를 지원할 때 재검사 |
|  27 | `@nx/devkit`                                 | 23.1.0       | root                                   | Compiler API 소비       | O2, L5, L6      | 조건부 지원          | 루트 `typescript`는 TS 6 API alias로 제공                |
|  28 | `@nx/js`                                     | 23.1.0       | root                                   | Compiler API 소비       | O2, L5, L6      | 조건부 지원          | TS 7 CLI와 TS 6 API 병행                                 |
|  29 | `@playwright/test`                           | 1.61.1       | docs, git, readme                      | 테스트 runner           | L1, L8          | TypeScript 비결합    | Playwright 설정 타입 검사 유지                           |
|  30 | `@tailwindcss/postcss`                       | 4.3.3        | docs, readme                           | CSS build               | L4              | TypeScript 비결합    | -                                                        |
|  31 | `@tailwindcss/vite`                          | 4.3.3        | git                                    | Vite plugin             | L3              | 지원 확인            | Vite 빌드 유지                                           |
|  32 | `@tanstack/react-virtual`                    | 3.14.7       | git                                    | React 선언 소비         | L1, L3          | 지원 확인            | -                                                        |
|  33 | `@types/mdx`                                 | 2.0.14       | docs                                   | 전역 JSX 선언           | L1, L7          | 기준선 오류로 미확정 | React 19 JSX namespace 호환 선언 확인                    |
|  34 | `@types/node`                                | 26.1.1       | 전체 TS workspace                      | 표준 선언               | L1, L2          | 지원 확인            | Node 메이저와 함께 재검사                                |
|  35 | `@types/react`                               | 19.2.17      | root, docs, git, readme                | JSX 선언                | L1, L2          | 지원 확인            | -                                                        |
|  36 | `@types/react-dom`                           | 19.2.3       | root, docs, git, readme                | DOM/React 선언          | L1, L2          | 지원 확인            | -                                                        |
|  37 | `@vitejs/plugin-react`                       | 6.0.3        | git                                    | Vite transform          | L3              | 지원 확인            | Vite 빌드 유지                                           |
|  38 | `@vscode/ripgrep`                            | 1.18.0       | git                                    | native binary           | 설치 메타데이터 | TypeScript 비결합    | 플랫폼별 패키징 검사                                     |
|  39 | `@xterm/addon-fit`                           | 0.11.0       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  40 | `@xterm/xterm`                               | 6.0.0        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  41 | `chokidar`                                   | 5.0.0        | git                                    | 파일 감시 runtime       | L1, L3          | TypeScript 비결합    | Electron runtime smoke 유지                              |
|  42 | `class-variance-authority`                   | 0.7.1        | docs, git, readme                      | 선언 소비               | L1, L3, L4      | 지원 확인            | -                                                        |
|  43 | `clsx`                                       | 2.1.1        | docs, git, readme                      | 선언 소비               | L1, L3, L4      | 지원 확인            | -                                                        |
|  44 | `ds-store`                                   | 0.1.6        | git                                    | 패키징 runtime          | 설치 메타데이터 | TypeScript 비결합    | DMG 생성 시 확인                                         |
|  45 | `electron`                                   | 43.1.1       | git                                    | runtime + 대형 선언     | L1, L3, L7      | 기준선 오류로 미확정 | DOM lib 경계를 분리한 선언 검사 추가                     |
|  46 | `fflate`                                     | 0.8.3        | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  47 | `fs-xattr`                                   | 0.4.0        | git                                    | native runtime          | 설치 메타데이터 | TypeScript 비결합    | Node/Electron ABI 변경 시 재검사                         |
|  48 | `gray-matter`                                | 4.0.3        | docs                                   | 콘텐츠 runtime          | L2, L4          | TypeScript 비결합    | -                                                        |
|  49 | `lucide-react`                               | 1.25.0       | docs, git                              | React 선언 소비         | L1, L3, L4      | 지원 확인            | -                                                        |
|  50 | `macos-alias`                                | 0.2.12       | git                                    | macOS native runtime    | 설치 메타데이터 | TypeScript 비결합    | macOS 패키징 검사                                        |
|  51 | `next`                                       | 16.2.10      | docs, readme                           | Compiler API 직접 소비  | O1, O3, L4, L5  | 차단                 | Next.js가 TS 7 API/CLI 경로를 공식 지원할 때 재검사      |
|  52 | `node-gyp`                                   | 13.0.1       | git                                    | native build            | 설치 메타데이터 | TypeScript 비결합    | Node ABI 변경 시 재검사                                  |
|  53 | `node-pty`                                   | 1.1.0        | git                                    | native runtime          | L3              | TypeScript 비결합    | Electron package·smoke 유지                              |
|  54 | `nx`                                         | 23.1.0       | root                                   | Compiler API 소비       | O2, L5, L6      | 조건부 지원          | 듀얼 컴파일러 구성 필수                                  |
|  55 | `oxfmt`                                      | 0.59.0       | root                                   | 독립 formatter          | L8              | TypeScript 비결합    | -                                                        |
|  56 | `oxlint`                                     | 1.74.0       | root                                   | 독립 parser/linter      | L8              | 지원 확인            | lint 회귀 검사 유지                                      |
|  57 | `oxlint-tsgolint`                            | 0.25.0       | root                                   | Go 기반 타입 lint       | L8              | 지원 확인            | lint 규칙·plugin 버전 갱신 시 재검사                     |
|  58 | `postcss`                                    | 8.5.20       | docs, readme                           | CSS build               | L4              | TypeScript 비결합    | -                                                        |
|  59 | `react`                                      | 19.2.7       | root, docs, git, readme                | JSX runtime             | L1, L3, L4      | 지원 확인            | `@types/react`과 함께 갱신                               |
|  60 | `react-dom`                                  | 19.2.7       | root, docs, git, readme                | JSX/DOM runtime         | L1, L3, L4      | 지원 확인            | `@types/react-dom`과 함께 갱신                           |
|  61 | `rehype-slug`                                | 6.0.0        | docs                                   | AST plugin              | L2, L4          | TypeScript 비결합    | -                                                        |
|  62 | `remark-frontmatter`                         | 5.0.0        | docs                                   | AST plugin              | L2, L4          | TypeScript 비결합    | -                                                        |
|  63 | `remark-gfm`                                 | 4.0.1        | docs                                   | AST plugin              | L2, L4          | TypeScript 비결합    | -                                                        |
|  64 | `remark-mdx-frontmatter`                     | 5.2.0        | docs                                   | MDX AST plugin          | O1, L4          | 조건부 지원          | MDX workspace는 TS 6 유지                                |
|  65 | `remark-parse`                               | 11.0.0       | remark                                 | AST parser              | L1, L3          | 지원 확인            | -                                                        |
|  66 | `remark-stringify`                           | 11.0.0       | remark                                 | AST serializer          | L1, L3          | 지원 확인            | -                                                        |
|  67 | `scheduler`                                  | 0.27.0       | git                                    | React runtime           | L3              | TypeScript 비결합    | -                                                        |
|  68 | `sharp`                                      | 0.35.3       | icon                                   | native runtime + 선언   | L1, L2          | 지원 확인            | Node ABI와 이미지 생성 smoke 재검사                      |
|  69 | `tailwind-merge`                             | 3.6.0        | docs, git, readme                      | 선언 소비               | L1, L3, L4      | 지원 확인            | -                                                        |
|  70 | `tailwindcss`                                | 4.3.3        | docs, git, readme                      | CSS compiler            | L3, L4          | TypeScript 비결합    | -                                                        |
|  71 | `tsdown`                                     | 0.22.12      | root, remark, tooling                  | TS peer + d.ts 생성     | P1, L3, L7      | 조건부 지원          | 현재 빌드는 통과; `skipLibCheck: false` 선언 오류 추적   |
|  72 | `tw-animate-css`                             | 1.4.0        | git                                    | CSS runtime             | L3              | TypeScript 비결합    | -                                                        |
|  73 | `typescript`                                 | 6.0.3, 7.0.2 | 전체 TS workspace                      | 컴파일러/API            | O1, L1-L6       | 조건부 지원          | CLI는 7, API 소비자는 6으로 분리                         |
|  74 | `unified`                                    | 11.0.5       | remark                                 | AST pipeline 선언       | L1, L3          | 지원 확인            | -                                                        |
|  75 | `uuid`                                       | 14.0.1       | git                                    | 선언 소비               | L1, L3          | 지원 확인            | -                                                        |
|  76 | `vite`                                       | 8.1.5        | git                                    | TS 소스 transform/build | L3              | 지원 확인            | Vite 빌드와 config 로딩 유지                             |
|  77 | `vitest`                                     | 4.1.10       | root, docs, git, icon, remark, tooling | 테스트 transform        | L8              | 지원 확인            | 기존 실패와 TS 회귀를 분리                               |
|  78 | `zod`                                        | 4.4.3        | git                                    | 선언 집약 runtime       | L1, L3          | 지원 확인            | -                                                        |

## Compiler API 결합 전이 의존성

| 패키지                | 버전    | 관찰                                                                                                                  | 판정                  |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `rolldown-plugin-dts` | 0.27.11 | TypeScript 7 peer 범위를 선언하고 tsdown 빌드는 통과하지만, 공개 선언 일부가 기존 `typescript` API 타입을 import한다. | 조건부 지원           |
| `@nx/workspace`       | 23.1.0  | TypeScript AST·config 타입과 API를 사용하며 Nx graph 경로에 포함된다.                                                 | TypeScript 6 API 필요 |
| `listr2`              | 7.0.2   | `skipLibCheck: false`에서 선택적 `rxjs` 선언을 찾지 못한다.                                                           | 기준선 오류           |
| `browser-fs-access`   | 0.29.1  | Excalidraw 선언에서 package exports를 통해 타입 파일을 해석하지 못한다.                                               | 기준선 오류           |

## 구성별 실행 결과

### 현재 혼합 구성

| 명령/경계                                 | 결과                                              |
| ----------------------------------------- | ------------------------------------------------- |
| TypeScript 7로 8개 tsconfig `--noEmit`    | 통과                                              |
| `pnpm typecheck`                          | 통과                                              |
| `tooling`, `remark-plantuml` tsdown build | 통과                                              |
| Git Client `tsc` + Vite build             | 통과                                              |
| Git Client Electron package + 검증        | arm64, Electron 43.1.1에서 통과                   |
| 두 Next.js 앱 `next build`                | TypeScript 6.0.3에서 통과                         |
| `pnpm exec nx show projects`              | 실패: `tsModule.readConfigFile is not a function` |
| 변경 전 `pnpm check`                      | 테스트 단계에서 기존 10개 실패                    |

현재 상태는 “부분 전환 성공”이 아니다. 루트 TypeScript 7 때문에 Nx 기반 릴리스 분석이 이미
깨져 있으므로 듀얼 구성이 도입되기 전까지 릴리스 경로를 신뢰할 수 없다.

### 단일 TypeScript 7 격리 구성

`engineering-docs`와 `readme`까지 `typescript@7.0.2`로 맞춘 일회용 복사본에서 확인했다.

- Nx graph: `readConfigFile` 부재로 실패
- `engineering-docs` typecheck: `readConfigFile`, `sys`, `createProgram`,
  `flattenDiagnosticMessageText` 등 Compiler API 부재로 실패
- Next.js build: `typescript/lib/typescript.js`를 필요한 패키지로 찾은 뒤 타입 검사 실패
- `tooling`, `remark-plantuml` tsdown build: 통과

즉, 소스 문법 호환성과 도구 체인 호환성은 별개의 문제다.

### 듀얼 컴파일러 격리 구성

루트에 다음 역할을 분리한 일회용 복사본에서 확인했다.

- `@typescript/native`: `typescript@7.0.2`, `tsc` 제공
- `typescript`: `@typescript/typescript6@6.0.2` alias, 기존 API와 `tsc6` 제공
- Next.js 앱: 기존 TypeScript `6.0.3` 유지

검증 결과 `tsc`는 7.0.2, `tsc6`과 API는 6.0.3을 보고했고, `readConfigFile`과
`createProgram`을 제공했다. Nx 프로젝트 7개 탐색, 두 tsdown 패키지 빌드, README Next.js
빌드가 통과했다. 이는 공식 병행 구성이 현재 차단 요소를 해소할 수 있음을 보여 주지만,
이 보고서에서는 실제 manifest를 변경하지 않는다.

## `skipLibCheck` 진단

현재 정상 gate는 `skipLibCheck: true`다. 이를 `false`로 바꾼 진단은 다음 기존 경계를 드러냈다.

- Electron main config: Forge의 `NewCtx`, Electron의 DOM 전역, `listr2`의 `rxjs`
- Engineering Docs: 중복 Next 생성 타입, Excalidraw 전이 선언, `@types/mdx`의 JSX namespace
- tsdown 소비 패키지: 선택적 peer 선언과 `rolldown-plugin-dts`의 기존 TypeScript API 타입

따라서 `skipLibCheck: false` 실패를 곧바로 TS 7 회귀로 분류하지 않았다. 다만 TS 7 전환
승인 전에 별도 선언 부채로 추적해야 한다.

## 기존 기준선 실패

`pnpm check`는 format과 typecheck를 통과한 뒤 847개 테스트 중 10개가 실패했다.

- 누락된 GitHub workflow를 읽는 테스트 3개
- tsdown 기대 버전이 0.22.7에 남은 package contract 테스트 2개
- icon target/asset drift 1개
- 잘못된 `ddd copy.mdx`와 stale manifest에 따른 콘텐츠 계약 2개
- 존재하지 않는 README UI 경로를 읽는 디자인 시스템 테스트 1개
- 로컬 PATH의 `codex` 해석에 영향을 받는 symlink 테스트 1개

이 실패들은 TypeScript 7에서 새로 발생한 것으로 세지 않는다. 새 문서 통합으로 직접 영향을
받는 콘텐츠 중복과 manifest는 이번 변경에서 해결하고, 나머지는 별도 작업으로 남긴다.

## 문서 변경 후 검증

- 콘텐츠 생성기: 한·영 22개 문서 검증 및 manifest/search index 생성 통과
- Engineering Docs: 타입 검사와 17개 테스트 통과
- Engineering Docs production build: 새 경로를 포함한 28개 route 생성 통과
- Git Client Electron package: darwin arm64, Electron 43.1.1, ASAR·fuse·codesign 검증 통과
- 전체 `pnpm check`: format, lint, typecheck 통과 후 847개 중 8개 테스트 실패

변경 전 콘텐츠 계약 실패 2개는 해결됐다. 남은 8개는 누락된 workflow 3개, 오래된 tsdown
기대값 2개, icon drift 1개, README UI 경로 1개, 로컬 PATH symlink 1개이며 이번 문서 범위
밖이다.

## 권고

1. 현재 상태에서 모든 workspace를 TypeScript 7로 통일하지 않는다.
2. 후속 변경에서 Nx 공식 듀얼 컴파일러 구성을 별도 PR로 도입한다.
3. `engineering-docs`와 `readme`는 Next.js·MDX·Compiler API 지원이 확인될 때까지
   TypeScript 6.0.3을 유지한다.
4. CI에서 `nx show projects`, 모든 tsconfig typecheck, tsdown build, Vite/Electron package,
   Next.js build를 각각 독립 gate로 둔다.
5. TypeScript 7.1 또는 Next.js/Nx/MDX 릴리스가 API 전환을 발표하면 이 보고서의
   `verifiedAt`에 해당하는 검증일과 전체 행을 다시 평가한다.
