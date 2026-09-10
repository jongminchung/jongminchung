# Issue 0007: Web 앱의 CI 검증 공백 해소

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `f440afe`
- 우선순위: P0
- 기준일: 2026-08-19
- 영향 범위:
  [Web package](../../../../apps/web/package.json),
  [Web Playwright 설정](../../../../apps/web/playwright.config.ts),
  [Web workflow](../../../../.github/workflows/web.yml)

## 핵심 요약

- **`Web verify`가 Web consumer 변경의 typecheck·unit test·standalone build·Playwright를 검증함**
- **Ubuntu CI용 Linux 시각 회귀 snapshot 14개를 macOS snapshot과 병행 관리함**
- **`main` 직접 push 뒤 고정 job 결과로 회귀를 탐지하고 bundle report와 실패 evidence를 보존함**
- **branch protection을 사용하지 않으므로 CI 실패가 `main` push 자체를 사전에 차단하지는 못함**
- **월요일 scheduled content evidence report의 첫 성공 실행은 후속 운영 확인으로 남김**

## 확인한 문제와 근거

- **도입 전에는 Web 검증이 로컬 script로만 존재하고 GitHub workflow에서 실행되지 않았음**
    - `typecheck`, `test`, `build`, `test:e2e`가 package script로 존재함
    - `.github/workflows`에는 Web 검증 전용 workflow가 없었음
- **Web build는 일반 Next build보다 추가 계약이 있음**
    - Excalidraw asset 준비와 검사
    - Node 26의 standalone 실행 옵션
    - 세 도메인의 Host 기반 routing
    - standalone server를 사용하는 Playwright web server
- **도입 전에는 브라우저 실패 artifact를 CI에서 보존하지 않았음**
    - Playwright 설정은 trace·screenshot·video를 생성함
    - 이를 CI artifact로 보존하는 workflow가 없었음

## 채택할 내용

- **Web 전용 GitHub Actions workflow를 추가함**
    - Web consumer graph의 frozen lockfile install
    - Web typecheck와 unit test
    - production standalone build와 bundle report
    - Chromium Playwright E2E
- **변경 경로는 실제 consumer graph를 포함함**
    - `apps/web/**`
    - `packages/ui/**`
    - `packages/tooling/**`
    - root package·lockfile·workspace와 공용 TypeScript·Vitest 설정
    - Web workflow 자체
- **실패 evidence를 artifact로 업로드함**
    - Playwright trace
    - screenshot diff와 failure screenshot
    - retained video
    - 필요한 build diagnostic
- **동일 branch의 오래된 실행을 취소함**
    - workflow와 Git ref 기반 concurrency group을 사용함
    - 최신 commit 결과만 회귀 판단에 사용함

## 채택하지 않을 내용

- **Web CI에서 production deploy를 수행하지 않음**
- **Web 단일 workspace 명령을 전달하는 루트 script를 새로 만들지 않음**
- **artifact에 environment secret이나 전체 build output을 무조건 포함하지 않음**
- **경로 filter 때문에 root 설정 변경이 누락되지 않도록 함**

## 실행 작업

- **`.github/workflows/web.yml`의 trigger와 권한을 최소 범위로 정의함**
- **단일 `Web verify` job에서 build 결과를 browser 검증에 이어서 사용함**
- **pnpm cache와 Playwright Chromium system dependency 설치를 명시함**
- **artifact upload에 `if: failure()` 또는 `if: always()`를 목적에 맞게 적용함**
- **`Web verify` 고정 job 이름으로 `main` push 이후 회귀 결과를 추적함**

## 완료 조건

- **Web 또는 직접 consumer dependency 변경이 `main`에 push되면 Web workflow가 실행됨**
- **Web typecheck·test·build·E2E 실패가 push 이후 고정 job에서 식별됨**
- **standalone server와 세 Host 기반 route가 CI에서도 검증됨**
- **Playwright 실패 artifact와 Web bundle report가 GitHub Actions artifact로 보존됨**
- **Web과 무관한 변경에서 불필요한 browser job 실행을 합리적으로 제한함**
- **workflow가 source와 pull request metadata에 read-only 권한만 사용함**

## 검증

- **로컬에서 workflow와 동일한 workspace 명령을 실행함**
    - `pnpm --filter @jongminchung/web run typecheck`
    - `pnpm --filter @jongminchung/web run test`
    - `pnpm --filter @jongminchung/web run build`
    - `pnpm --filter @jongminchung/web run test:e2e`
- **[`f440afe`의 원격 `Web verify`](https://github.com/jongminchung/jongminchung/actions/runs/32320171823)가 성공함**
    - 기능 E2E 36개와 Linux 시각 E2E 14개를 포함한 50개 검사가 통과함
    - `web-bundle-report` artifact 생성을 확인함
- **최종 `pnpm run check`와 `git diff --check`가 통과함**
    - 공유 Ubuntu host에서는 `VITEST_MAX_WORKERS=2`로 unit test worker 수만 제한함

## 구현 결과

- **Web 검증 workflow와 Linux 시각 회귀 기준선을 완료함**
    - `.github/workflows/web.yml`에 Web typecheck·test·build·E2E를 연결함
    - `apps/web`, `packages/ui`, `packages/tooling`과 직접 설정 변경에만 push workflow가 실행되도록 제한함
    - Playwright 실패 artifact를 보존하도록 구성함
- **`main` push의 원격 검증을 완료함**
    - Web consumer graph만 filtered install하고 Linux snapshot 14개를 추가해 후속 실행을 성공시킴
- **고정 job과 consumer 경로 판정을 유지함**
    - 모든 pull request에서 고정 `Web verify` job을 생성함
    - `dorny/paths-filter`가 Web consumer 변경을 판정하고 관련 없는 PR에서는 무거운 검증 step만 생략함
    - pull request metadata와 source에는 read-only 권한만 사용함
- **`main` 직접 push 운영의 한계를 명시함**
    - branch protection과 required check를 사용하지 않아 실패한 CI가 push 자체를 차단하지 못함
    - 실패가 발생하면 `Web verify` 결과와 artifact를 기준으로 후속 수정함
- **scheduled content evidence의 첫 운영 성공은 후속 확인으로 남김**
    - 월요일 `01:17 UTC` 실행에서 `content-evidence` artifact 생성 여부를 확인해야 함
