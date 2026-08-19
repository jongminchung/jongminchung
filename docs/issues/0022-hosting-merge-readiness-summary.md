# Issue 0022: Hosting 변경 요청의 merge-readiness 요약

- 상태: 제안
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [HostingPanel](../../apps/git-client/src/components/HostingPanel.tsx),
  [Hosting 요청 계약](../../apps/git-client/src/shared/contracts/model/HostingRequest.ts),
  [Hosting 응답 계약](../../apps/git-client/src/shared/contracts/model/HostingResponse.ts),
  [Hosting service](../../apps/git-client/electron/hosting/hosting-service.ts),
  [packaged Hosting E2E](../../apps/git-client/electron-tests/packaged-hosting-harness.ts)
- 참고 OSS:
  [GitHub CLI `gh pr checks`](https://cli.github.com/manual/gh_pr_checks),
  [GitHub Desktop](https://github.com/desktop/desktop),
  [GitLab MR Widgets Demo](https://gitlab.com/gitlab-org/frontend/playground/gitlab-mr-widgets-demo)

## 핵심 요약

- **현재 Hosting 기능은 변경 요청의 목록·상세·파일·타임라인·댓글·리뷰까지 제공하지만 병합 가능 여부를 한 번에 판단할 상태가 없음**
- **CI·필수 검사·리뷰 충족·충돌·branch update 필요 여부를 provider 공통 read model로 정규화할 필요가 있음**
- **첫 범위는 상태 조회와 실패 검사 상세 링크까지로 제한하고 병합·재실행 같은 mutation은 포함하지 않음**
- **GitHub와 GitLab의 서로 다른 상태를 사용자 행동 기준인 ready·blocked·pending·unknown으로 표현해야 함**
- **완료 기준은 모든 provider 기능의 동일화가 아니라 지원 범위와 알 수 없는 상태를 정확히 드러내는 것임**

## OSS 기준에서 확인한 제품 패턴

- **GitHub CLI는 PR 검사를 사용자 판단에 필요한 bucket으로 정규화함**
  - `pass`, `fail`, `pending`, `skipping`, `cancel` 상태를 제공함
  - 필수 검사만 조회하는 `--required`와 실행 상세 링크를 제공함
  - pending과 failure를 서로 다른 결과와 exit status로 구분함
- **GitLab은 merge request widget에서 pipeline·status check·code quality 같은 병합 판단 정보를 한 surface에 모음**
- **채택할 핵심은 provider API 구조가 아니라 사용자가 지금 병합 가능한지를 빠르게 판단하는 정보 계층임**

## 현재 저장소의 공백

- **`HostingRequest`에는 check·pipeline·mergeability·review decision 조회가 없음**
  - 현재 계약은 list, get, files, timeline, viewed state, create, comment, review와 branch update를 중심으로 구성됨
  - 변경 요청 상세를 열어도 외부 웹 페이지를 다시 확인해야 병합 준비 상태를 알 수 있음
- **provider별 정보 차이를 표현할 명시적 capability가 없음**
  - GitHub required check와 GitLab pipeline·approval rule은 같은 필드를 제공하지 않음
  - 미지원과 API 오류와 아직 계산 중인 상태가 하나의 빈 값으로 합쳐질 위험이 있음
- **polling과 stale response 정책이 정의되지 않음**
  - 장시간 실행되는 CI 상태가 화면에 오래 남을 수 있음
  - 다른 변경 요청으로 전환한 뒤 이전 응답이 현재 선택에 반영되지 않아야 함

## 채택할 내용

- **provider 공통 `MergeReadiness` read model을 정의함**
  - overall state: ready, blocked, pending, unknown
  - checks summary와 required 여부
  - review 또는 approval 충족 여부
  - conflict 또는 mergeability 상태
  - source branch update 필요 여부
  - provider 상세 페이지 URL과 마지막 확인 시각
- **상태별 원인과 다음 행동을 함께 표시함**
  - 실패한 검사 이름과 상세 링크
  - 진행 중인 검사 수
  - 부족한 승인 또는 review 상태
  - 충돌 해결이나 branch update 필요 여부
- **provider capability와 unknown reason을 명시함**
  - unsupported
  - permission-denied
  - not-computed
  - request-failed
- **선택 변경·새로고침·취소에 안전한 조회 수명주기를 적용함**

## 채택하지 않을 내용

- **첫 단계에서 변경 요청 병합이나 CI 재실행 mutation을 추가하지 않음**
- **GitHub와 GitLab의 세부 상태를 손실된 boolean 하나로 축약하지 않음**
- **unknown 상태를 ready로 간주하지 않음**
- **고정 간격 polling을 창이 숨겨진 상태에서도 무기한 실행하지 않음**
- **provider 웹 UI 전체를 복제하지 않음**

## 실행 작업

- **GitHub와 GitLab API에서 확보 가능한 merge-readiness 필드를 inventory함**
- **공통 contract와 provider capability matrix를 정의함**
- **Hosting detail에 read-only summary와 실패 원인 목록을 추가함**
- **수동 refresh와 제한된 active polling 정책을 구현함**
- **권한 부족·rate limit·provider 미지원·stale response 회귀 test를 추가함**
- **packaged 환경에서 Keychain account를 사용한 조회 경계를 검증함**

## 완료 조건

- **지원되는 변경 요청에서 검사·리뷰·충돌·branch 상태를 한 화면에서 확인할 수 있음**
- **blocked 상태마다 사용자가 취할 수 있는 다음 행동 또는 상세 링크가 제공됨**
- **미지원·권한 부족·조회 실패가 서로 구분됨**
- **선택을 빠르게 전환해도 이전 변경 요청의 상태가 표시되지 않음**
- **provider 응답 fixture와 실제 contract test가 공통 상태 변환을 검증함**

## 검증

- **Hosting의 가까운 검증부터 실행함**
  - `pnpm --filter @jongminchung/git-client run test`
  - Hosting provider integration test
  - packaged Hosting E2E
  - `pnpm --filter @jongminchung/git-client run typecheck`
- **최종 `pnpm run check`, `git diff --check`, `git status --short`를 실행함**
