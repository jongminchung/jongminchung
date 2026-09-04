# Bun standalone 런타임

- **Web 개발·빌드 orchestration·standalone 실행은 Bun 1을 주 런타임으로 사용함**
- **Next.js CLI는 `bun run --bun`으로 실행해 Node shebang 대신 Bun 런타임을 강제함**
- **Vercel Function과 OCI 컨테이너도 Bun 1을 사용해 로컬과 배포 경계를 일치시킴**
- **공개 `packages/*`의 Node.js 24 이상 호환 계약에는 이 앱 런타임 결정이 적용되지 않음**

## 앱 실행 경계를 Bun으로 통일함

- **`apps/web/package.json`의 `dev`, `build`, `typecheck`는 Bun으로 JavaScript CLI를 실행함**
  - `bun run --bun`은 `next`, `tsc`처럼 Node shebang을 가진 CLI도 Bun 런타임으로 실행함
  - TypeScript 앱 script는 별도 loader 없이 `bun`으로 직접 실행함
  - Unit·Integration은 Bun 내장 test runner에서 실행하고 Playwright는 자체 Node 실행 계약을 유지함

- **Fumadocs와 Turbopack이 요구하는 loader worker만 Node.js로 격리함**
  - `validate-fumadocs-content.ts`와 `content-evidence.ts`는 `fumadocs-mdx/node`가 등록하는 MDX query loader를 사용함
  - `next.config.ts`는 Bun의 재귀적 `node` 별칭을 loader worker에서만 제거해 Turbopack worker가 실제 Node IPC를 사용하게 함
  - Web build의 Fumadocs 생성·자산 준비·Next.js main process와 실제 server runtime은 Bun을 유지함
  - CI와 Docker builder에는 build-time loader worker용 Node.js가 필요하지만 배포 runner에는 필요하지 않음

- **Kroki SVG 변환은 build-time 네트워크 조회 없이 수행함**
  - `remark-kroki-url.ts`는 PlantUML 코드 블록과 기존 Kroki Markdown 이미지를 MDX `img` 노드로 먼저 정규화함
  - Fumadocs `remark-image`보다 앞에서 실행하므로 Kroki 장애가 content validation과 Turbopack build를 중단하지 않음

- **standalone 서버는 준비 script와 생성된 `server.js`를 모두 Bun으로 실행함**
  - 명령은 `bun scripts/prepare-standalone.ts && bun .next/standalone/apps/web/server.js`임
  - 기존 Node 26 전용 `--no-require-module` 우회는 Bun 전환으로 제거됨

## 배포 런타임을 같은 계열로 유지함

- **Vercel은 `vercel.json#bunVersion`의 `1.x`로 Bun Function runtime을 선택함**
  - 의존성 설치는 `bunx bun@1.4.0 install --frozen-lockfile`로 실행해 Bun `1.4.0`이 생성한 `bun.lock`을 같은 버전으로 해석함
  - Vercel이 Function runtime의 minor·patch를 관리하므로 앱 실행 시점의 patch 수준은 설치 도구와 다를 수 있음
  - Bun 버전을 올릴 때는 `.bun-version`, `package.json#packageManager`, Vercel Install Command와 컨테이너 이미지를 함께 갱신해야 함
  - Bun 고유 API를 추가할 때는 Vercel이 제공하는 Bun 1 범위에서도 동작하는지 Preview 배포로 확인해야 함

- **컨테이너는 build와 runner stage 모두 `oven/bun:1.4.0-alpine`을 사용함**
  - build는 루트 `bun.lock`으로 설치한 뒤 Web workspace build를 실행함
  - runner는 공식 이미지의 비루트 `bun` 사용자로 standalone 서버를 실행함

## 공개 패키지의 Node 호환성을 별도로 검증함

- **`packages/tooling`과 `packages/ui`는 Bun 전용 API를 사용하지 않음**
  - 두 package는 `engines.node: ">=24.0.0"`, ESM JavaScript와 declaration 산출물을 유지함
  - package test는 Bun 내장 runner로 실행하되 build된 공개 entry를 Node 24·26에서 별도 import해 runtime 호환성을 검증함

- **게시 후 검증은 깨끗한 npm 소비자에서 Node import를 실행함**
  - GitHub Actions는 Bun으로 설치·빌드·게시하되 Node를 별도로 설정함
  - `.github/scripts/verify-published-package.ts`는 npm 설치 후 `process.execPath`의 Node로 공개 subpath를 import함

## 검증 기준

- **로컬 앱 검증은 Bun 기반 build와 standalone 시작을 확인함**
  - 명령: `bun run --filter @jongminchung/web build` 후 `bun run --filter @jongminchung/web start`
  - 사례: `/healthz`는 200, `Host: tech.jamie.kr` 문서는 200, 제거된 private route는 404여야 함

- **브라우저와 컨테이너 경계를 추가로 확인함**
  - 명령: 사전 기동 서버 없이 `bun run --filter @jongminchung/web test:e2e`
  - 명령: `docker build -f apps/web/docker/Dockerfile -t jamie-web .` 후 `docker run --rm -p 3000:3000 jamie-web`
  - 사례: Playwright와 컨테이너에서 health·Host 기반 route가 같은 응답을 제공해야 함

## 재검토 조건

- **Bun 또는 Next.js major 업데이트 시 CLI·standalone·Vercel 세 경계를 함께 재검증해야 함**
  - Bun이 Turbopack loader worker의 Node IPC를 완전히 지원하면 `next.config.ts`의 worker 격리를 제거할 수 있는지 재검증해야 함
  - Vercel Bun runtime의 지원 범위가 바뀌면 `vercel.json`, 배포 문서와 Preview 검증 기준을 함께 갱신해야 함
