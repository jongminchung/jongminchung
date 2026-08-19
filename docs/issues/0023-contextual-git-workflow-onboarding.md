# Issue 0023: 상황 기반 Git 업무 온보딩 도입

- 상태: 실행 계획 확정
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [WelcomeWorkspace](../../apps/git-client/src/components/WelcomeWorkspace.tsx),
  [command manifest](../../apps/git-client/src/command-manifest.json),
  [repository feature](../../apps/git-client/src/features/repository),
  [welcome test](../../apps/git-client/src/components/WelcomeWorkspace.test.ts),
  [app E2E](../../apps/git-client/tests/app.spec.ts)
- 참고 OSS:
  [VS Code UX Walkthroughs](https://code.visualstudio.com/api/ux-guidelines/overview),
  [VS Code](https://github.com/microsoft/vscode),
  [GitHub Desktop](https://github.com/desktop/desktop)

## 핵심 요약

- **현재 앱은 많은 Git 기능과 command를 제공하지만 첫 사용자가 목표별 다음 행동을 발견하기 어려움**
- **Welcome 화면은 저장소 생성·열기·복제와 appearance 설정에 집중되어 repository를 연 뒤의 업무 안내가 없음**
- **고정 제품 투어보다 현재 repository 상태에서 실행 가능한 작업을 제안하는 checklist가 적합함**
- **온보딩은 새로운 command 구현이 아니라 기존 command를 안전한 순서와 완료 조건으로 연결하는 product layer여야 함**
- **사용자 진행 상태는 로컬에만 저장하고 언제든 닫기·재시작·초기화할 수 있어야 함**

## 처리 결과

- **온보딩 action은 기존 `changes.commit`과 `repository.push` 등 command manifest ID를 실행하는 product layer로 한정함**
  - 별도 Git mutation 경로를 만들지 않는 원칙을 확정함
- **진행 상태 저장 키는 repository ID를 포함하고 click 여부가 아닌 refresh된 Git 상태로 완료를 계산하는 계약으로 확정함**
  - conflict·safe mode·operation in progress에서는 mutation task를 비활성화하고 command availability 사유를 그대로 표시해야 함
- **현재 Welcome 화면에는 열린 repository context가 없으므로 repository별 predicate를 Welcome에 직접 결합하지 않기로 결정함**
  - 실제 task surface는 repository workbench에서 command registry와 session refresh를 함께 사용할 수 있는 경계에 배치할 필요가 있음
- **repository 전환과 safe mode를 포함한 상태 저장 설계가 선행되지 않은 단순 checklist UI는 잘못된 완료 상태를 공유할 수 있어 이번 변경에서는 구현을 보류함**

## OSS 기준에서 확인한 제품 패턴

- **VS Code Walkthrough는 여러 기능을 목표 중심의 다단계 checklist로 제공함**
  - 사용자가 기능 이름을 미리 알지 못해도 작업 순서를 따라갈 수 있음
  - 각 단계는 command나 설정 surface로 직접 연결됨
  - 완료된 단계와 남은 단계를 구분함
- **GitHub Desktop은 광범위한 Git 명령보다 clone·branch·commit·push·PR 같은 핵심 사용자 여정을 전면에 둠**
- **채택할 핵심은 화면 복제가 아니라 command discovery를 repository context와 연결하는 방식임**

## 현재 저장소의 공백

- **Welcome navigation은 `Projects`와 `Customize` 두 영역만 제공함**
  - 저장소를 연 뒤에는 많은 menu·tool window·command palette를 스스로 탐색해야 함
- **command manifest의 기능 수와 첫 사용자 노출 사이에 계층이 없음**
  - 모든 command를 동일한 discovery surface에 두면 핵심 workflow가 고급 기능에 묻힐 수 있음
  - repository 상태상 실행할 수 없는 command도 이름만으로는 이유를 알기 어려움
- **상황별 빈 상태가 다음 작업으로 일관되게 연결되지 않음**
  - remote 없음
  - upstream 없음
  - unpublished commit 존재
  - conflict 또는 in-progress operation 존재
  - Hosting account 미연결

## 채택할 내용

- **첫 repository 업무를 위한 기본 workflow를 정의함**
  - 변경 확인
  - stage와 commit
  - remote 또는 upstream 확인
  - push
  - Hosting 연결과 변경 요청 생성
- **repository 상태에 따른 상황별 task card를 제공함**
  - remote가 없으면 Share Repository 또는 remote 설정
  - upstream이 없으면 destination preview를 포함한 첫 push
  - unpublished commit이 있으면 push 또는 변경 요청 생성
  - conflict가 있으면 conflict tool window와 abort 경로
  - 안전하지 않은 repository이면 trust 설명과 제한된 기능 안내
- **기존 command manifest를 온보딩 action의 단일 실행 경로로 재사용함**
  - command ID와 availability 결과를 사용함
  - 별도 event handler에 Git mutation을 중복 구현하지 않음
- **로컬 진행 상태와 명시적 reset을 제공함**

## 채택하지 않을 내용

- **앱 실행마다 강제로 나타나는 modal tour를 만들지 않음**
- **사용자 repository 내용을 외부 analytics로 전송하지 않음**
- **단계 완료를 단순 click 여부만으로 판단하지 않음**
- **기존 command와 별개의 Git 실행 경로를 만들지 않음**
- **모든 고급 기능을 첫 workflow에 포함하지 않음**

## 실행 작업

- **command inventory를 초급·일상·고급 workflow로 분류함**
- **repository context에서 계산 가능한 onboarding predicate를 정의함**
- **Welcome 또는 workbench에 dismissible task surface를 추가함**
- **각 task를 기존 command ID와 연결하고 실행 뒤 실제 Git 상태로 완료를 판정함**
- **저장소 전환·재실행·safe mode·offline 상태 회귀 test를 추가함**
- **기능 발견성과 중단률을 외부 telemetry 없이 평가할 수 있는 수동 QA 시나리오를 작성함**

## 완료 조건

- **새 사용자가 화면 안내만으로 저장소 열기부터 첫 push까지 진행할 수 있음**
- **repository 상태가 바뀌면 관련 task와 완료 상태가 즉시 갱신됨**
- **완료·dismiss·reset 상태가 저장소 간에 잘못 공유되지 않음**
- **비활성 action은 이유와 필요한 선행 작업을 표시함**
- **기존 command shortcut·palette·menu 동작과 동일한 실행 계약을 사용함**

## 검증

- **대표 사용자 여정을 component와 browser test로 검증함**
  - 빈 시작 화면
  - local-only repository
  - remote가 있지만 upstream이 없는 branch
  - unpublished commit이 있는 branch
  - conflict 또는 safe mode repository
- **가까운 검증과 전체 검사를 실행함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run test:e2e`
  - `pnpm --filter @jongminchung/git-client run typecheck`
  - 최종 `pnpm run check`
