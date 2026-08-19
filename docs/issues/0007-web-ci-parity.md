# Issue 0007: Web 앱의 CI 검증 공백 해소

- 상태: 진행 중
- 우선순위: P0
- 기준일: 2026-08-19
- 영향 범위:
  [Web package](../../apps/web/package.json),
  [Web Playwright 설정](../../apps/web/playwright.config.ts),
  [GitHub workflows](../../.github/workflows)

## 핵심 요약

- **현재 GitHub Actions에는 Git Client와 package publish workflow가 있지만 Web 전용 검증 workflow가 없음**
- **Web의 typecheck·unit test·standalone build·Playwright가 PR merge gate로 보장되지 않음**
- **Web과 직접 연결된 `packages/ui`, lockfile, 공용 설정 변경도 Web consumer 회귀를 만들 수 있음**
- **Web 전용 CI는 기존 workspace script를 조합하고 새로운 루트 전달 별칭을 만들지 않아야 함**
- **실패 시 screenshot·trace·video와 build log를 확인할 수 있어야 함**

## 현재 문제와 근거

- **Web 검증은 로컬 script로 존재하지만 GitHub workflow에서 실행되지 않음**
  - `typecheck`, `test`, `build`, `test:e2e`가 package script로 존재함
  - `.github/workflows`에는 Web 검증 전용 workflow가 없음
- **Web build는 일반 Next build보다 추가 계약이 있음**
  - Excalidraw asset 준비와 검사
  - Node 26의 standalone 실행 옵션
  - 세 도메인의 Host 기반 routing
  - standalone server를 사용하는 Playwright web server
- **브라우저 실패 artifact 정책이 Git Client와 다름**
  - Playwright 설정은 trace·screenshot·video를 생성함
  - 이를 CI artifact로 보존하는 workflow가 없음

## 채택할 내용

- **Web 전용 GitHub Actions workflow를 추가함**
  - frozen lockfile install
  - production dependency audit
  - Web과 직접 영향받는 source의 format·lint
  - Web typecheck와 unit test
  - production standalone build
  - Playwright E2E
- **변경 경로는 실제 consumer graph를 포함함**
  - `apps/web/**`
  - `packages/ui/**`
  - root lockfile, catalog와 공용 TypeScript·Oxc 설정
  - Web workflow 자체
- **실패 evidence를 artifact로 업로드함**
  - Playwright trace
  - screenshot diff와 failure screenshot
  - retained video
  - 필요한 build diagnostic
- **동일 branch의 오래된 실행을 취소함**
  - PR별 concurrency group을 사용함
  - 최신 commit 결과만 merge 판단에 사용함

## 채택하지 않을 내용

- **Web CI에서 production deploy를 수행하지 않음**
- **Git Client workflow와 Web workflow를 하나의 거대한 job으로 결합하지 않음**
- **Web 단일 workspace 명령을 전달하는 루트 script를 새로 만들지 않음**
- **artifact에 environment secret이나 전체 build output을 무조건 포함하지 않음**
- **경로 filter 때문에 root 설정 변경이 누락되지 않도록 함**

## 실행 작업

- **`.github/workflows/web.yml`의 trigger와 권한을 최소 범위로 정의함**
- **정적 검사와 browser 검증의 job 분리 여부를 실행 시간 기준으로 결정함**
- **Playwright browser 설치와 cache 범위를 명시함**
- **artifact upload에 `if: failure()` 또는 `if: always()`를 목적에 맞게 적용함**
- **branch protection에서 Web check를 required status로 연결할 수 있는 고정 job 이름을 사용함**

## 완료 조건

- **Web 또는 직접 consumer dependency 변경 PR에서 Web workflow가 실행됨**
- **Web typecheck·test·build·E2E 실패가 merge 전에 식별됨**
- **standalone server와 세 Host 기반 route가 CI에서도 검증됨**
- **Playwright 실패 artifact를 GitHub Actions에서 내려받을 수 있음**
- **Web과 무관한 변경에서 불필요한 browser job 실행을 합리적으로 제한함**
- **workflow가 read-only PR 검증 권한만 사용함**

## 검증

- **로컬에서 workflow와 동일한 workspace 명령을 실행함**
  - `pnpm --filter @jongminchung/web run typecheck`
  - `pnpm --filter @jongminchung/web run test`
  - `pnpm --filter @jongminchung/web run build`
  - `pnpm --filter @jongminchung/web run test:e2e`
- **workflow 변경 후 GitHub Actions에서 success와 의도된 failure artifact를 각각 확인함**
- **최종 `pnpm run check`와 `git diff --check`를 실행함**

## 구현 결과

- **로컬 구현은 완료됨**
  - `.github/workflows/web.yml`에 Web typecheck·test·build·E2E를 연결함
  - `apps/web`, `packages/ui`와 직접 설정 변경에만 workflow가 실행되도록 제한함
  - Playwright 실패 artifact를 보존하도록 구성함
- **원격 저장소 확인은 남아 있음**
  - GitHub Actions의 성공·실패 실행 확인이 필요함
  - branch protection에서 `Web verify`를 required check로 연결해야 함
