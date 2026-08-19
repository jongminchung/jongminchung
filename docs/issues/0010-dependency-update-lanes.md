# Issue 0010: 의존성 갱신 lane과 검증 범위 분리

- 상태: 완료
- 우선순위: P2
- 기준일: 2026-08-19
- 영향 범위:
  [루트 package](../../package.json),
  [pnpm workspace](../../pnpm-workspace.yaml),
  [유지보수 가이드](../maintenance.md)

## 핵심 요약

- **현재 `deps:update`는 TypeScript를 제외한 모든 workspace dependency를 한 번에 최신화함**
- **framework·UI·Electron·test·tooling 변경이 한 diff에 섞이면 회귀 원인과 rollback 범위가 커짐**
- **dependency를 기술 계층별 lane으로 분류하고 lane마다 필요한 검증을 연결해야 함**
- **자동 확인은 유용하지만 major update와 shadcn source 변경을 자동 병합하지 않아야 함**
- **루트 script는 저장소 전체 orchestration만 유지하고 단일 workspace 전달 별칭을 추가하지 않음**

## 현재 문제와 근거

- **`deps:check`와 `deps:update`가 모든 workspace를 동일한 단위로 처리함**
  - 업데이트 가능한 package를 한 번에 표시하고 적용함
  - runtime과 dev tooling 변경을 구분하지 않음
  - lockfile diff에서 원인별 dependency graph를 분리하기 어려움
- **UI stack은 minor·patch도 interaction을 바꿀 수 있음**
  - Tailwind generated CSS
  - Base UI focus·portal·keyboard 동작
  - cmdk selection과 ARIA
  - shadcn registry source
- **Electron과 Next.js는 서로 다른 검증 경계를 요구함**
  - Electron은 package·smoke·native boundary가 중요함
  - Next.js는 standalone build·Host routing·browser test가 중요함

## 채택할 내용

- **dependency를 다음 lane으로 분류함**
  - framework: React·React DOM·Next.js
  - UI: Tailwind CSS·shadcn CLI·Base UI·cmdk·animation
  - desktop: Electron·Electron Forge·native dependency
  - test: Vitest·Playwright·axe·coverage
  - tooling: TypeScript·Oxc·formatter·build tooling
- **한 변경에는 원칙적으로 하나의 lane만 포함함**
  - lockfile의 전이 변경은 허용하되 직접 dependency 목적은 하나로 유지함
  - 여러 lane을 함께 올려야 하면 결합 이유와 rollback 단위를 명시함
- **lane별 최소 검증을 연결함**
  - framework lane은 두 앱 build와 Web E2E
  - UI lane은 UI test와 두 앱 build, 관련 interaction test
  - desktop lane은 Electron package와 smoke test
  - test lane은 reporter·fixture 자체 test와 대표 suite
  - tooling lane은 root check와 package build
- **정기 report는 update 가능 항목만 알리고 자동 병합하지 않음**

## 채택하지 않을 내용

- **모든 dependency를 매번 최신 version으로 강제하지 않음**
- **shadcn registry source를 일반 package update와 함께 overwrite하지 않음**
- **major update를 patch와 같은 검증으로 처리하지 않음**
- **workspace별 `deps:update:*` 전달 별칭을 루트에 추가하지 않음**
- **advisory가 없는 일반 update를 production audit와 동일하게 취급하지 않음**

## 실행 작업

- **현재 catalog와 직접 dependency를 lane별로 inventory함**
- **`npm-check-updates` 실행 시 lane 하나만 선택하는 재현 가능한 방법을 정함**
- **PR template 또는 automation output에 lane·release note·검증 결과를 포함함**
- **scheduled report 도입 여부를 검토함**
  - repository write 권한 없이 report만 생성
  - major와 deprecated package를 별도 표시
  - 자동 PR이 필요해질 때 별도 결정
- **기존 `deps:check`와 `deps:update`의 역할을 전체 orchestration 관점에서 재검토함**

## 완료 조건

- **모든 직접 dependency가 하나의 기본 lane에 매핑됨**
- **lane 하나만 선택해 update 후보와 lockfile 변경을 만들 수 있음**
- **UI·framework·desktop update가 서로 다른 검증 조합을 사용함**
- **major update PR에 migration·rollback 조건이 포함됨**
- **shadcn source diff와 package version update가 구분됨**
- **기존 workspace command 정책을 위반하는 root alias가 추가되지 않음**

## 검증

- **lane별 sample update를 dry run으로 확인함**
  - 대상 lane 밖의 direct dependency가 변경되지 않음
  - lockfile 변경이 frozen install에서 재현됨
  - 영향받는 workspace의 typecheck·test·build가 통과함
- **최종 `pnpm run check`, `git diff --check`, `git status --short`를 실행함**

## 2026-08-20 구현 결과

- **모든 외부 직접 dependency를 framework·UI·desktop·test·tooling 중 하나에 정확히 매핑함**
  - `deps:inventory`가 중복 lane과 미분류 dependency를 실패로 처리함
  - 내부 `@jongminchung/*` workspace dependency는 update 대상에서 제외함
- **`deps:check`와 `deps:update`가 lane 인자를 필수로 받아 한 lane만 처리하도록 변경함**
  - `pnpm run deps:check -- framework` 형식으로 후보를 확인함
  - `pnpm run deps:update -- framework` 형식으로 해당 직접 dependency와 lockfile만 갱신함
- **Renovate의 단일 non-major group을 같은 5개 lane group으로 분리함**
  - major update의 Dependency Dashboard 승인 정책은 유지함
- **유지보수 문서에 lane별 최소 검증, release note, migration·rollback과 shadcn source 분리 계약을 기록함**
  - TypeScript는 tooling lane에 표시되지만 기존 호환성 재감사 조건 없이 적용하지 않음
- **framework lane dry run에서 lane 밖 dependency 후보가 출력되지 않음을 확인함**
