# Issue 0022: Hosting 변경 요청의 merge-readiness 요약

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `55a344d`
- 우선순위: P1
- 기준일: 2026-08-19
- 영향 범위:
  [HostingPanel](../../../../apps/git-client/src/components/HostingPanel.tsx),
  [Hosting 요청 계약](../../../../apps/git-client/src/shared/contracts/model/HostingRequest.ts),
  [Hosting 응답 계약](../../../../apps/git-client/src/shared/contracts/model/HostingResponse.ts),
  [Hosting service](../../../../apps/git-client/electron/hosting/hosting-service.ts),
  [packaged Hosting E2E](../../../../apps/git-client/electron-tests/packaged-hosting-harness.ts)
- 참고 OSS:
  [GitHub CLI `gh pr checks`](https://cli.github.com/manual/gh_pr_checks),
  [GitHub Desktop](https://github.com/desktop/desktop),
  [GitLab MR Widgets Demo](https://gitlab.com/gitlab-org/frontend/playground/gitlab-mr-widgets-demo)

## 핵심 요약

- **GitHub와 GitLab의 mergeability 응답을 `ready`·`blocked`·`pending`·`unknown` 공통 read model로 정규화함**
- **검사·리뷰·충돌·branch update capability를 명시해 provider가 제공하지 않는 신호를 성공으로 오인하지 않도록 함**
- **Hosting 상세 화면에 read-only merge-readiness와 차단·대기·조회 실패 원인을 표시함**
- **권한 부족과 rate limit은 상세 화면 전체를 실패시키지 않고 `unknown` 원인으로 보존함**
- **변경 요청·계정·project 선택 sequence를 적용해 늦게 도착한 이전 응답이 현재 선택을 덮지 않도록 함**

## 처리 결과

- **`mergeReadiness` 요청과 응답 계약을 별도 구성해 기존 변경 요청 상세 모델에 추정 boolean을 혼합하지 않도록 함**
  - 응답은 전체 상태, 원인 배열, 네 가지 capability와 확인 시각을 포함함
- **GitHub pull request의 `mergeable`·`mergeable_state`·draft 상태를 충돌·branch update·검사 대기·리뷰 필요 원인으로 변환함**
  - 상세 REST 응답만으로 확인할 수 없는 required checks와 review rule은 capability `false`와 `provider-unsupported`로 표시함
- **GitLab merge request의 `detailed_merge_status`와 `head_pipeline.status`를 검사·승인·충돌·rebase 상태로 변환함**
  - GitLab 상세 응답에서 제공되는 네 가지 dimension의 capability를 명시함
- **HTTP 401·403과 429를 각각 `permission-denied`와 `rate-limited`로 변환함**
  - 다른 네트워크·provider 실패는 `provider-unavailable`로 보존함
- **상세·파일·타임라인·readiness를 함께 조회하고 동일 inspection sequence가 유지될 때만 화면 상태를 갱신함**
  - 계정이나 project가 바뀌면 진행 중 sequence를 무효화하고 이전 상세 상태를 비움

## OSS 기준에서 확인한 제품 패턴

- **GitHub CLI는 PR 검사를 사용자 판단에 필요한 bucket으로 정규화함**
  - `pass`, `fail`, `pending`, `skipping`, `cancel` 상태를 제공함
  - 필수 검사만 조회하는 `--required`와 실행 상세 링크를 제공함
  - pending과 failure를 서로 다른 결과와 exit status로 구분함
- **GitLab은 merge request widget에서 pipeline·status check·code quality 같은 병합 판단 정보를 한 surface에 모음**
- **채택할 핵심은 provider API 구조가 아니라 사용자가 지금 병합 가능한지를 빠르게 판단하는 정보 계층임**

## 구현된 계약

- **`HostingMergeReadiness`가 provider 차이를 사용자 행동 중심 상태로 정규화함**
  - 차단 원인은 실패 검사·충돌·draft·리뷰·branch update로 구분됨
  - 대기 원인은 실행 중 검사와 provider 계산 중 상태로 구분됨
  - 알 수 없음 원인은 권한·rate limit·미지원·provider 장애로 구분됨
- **`HostingRequestDetails`가 상태와 원인을 읽기 전용으로 표시함**
  - 검사·리뷰·충돌·branch update별 사용 가능 여부를 함께 표시함
- **`HostingInspectionSequence`가 selection race를 독립적으로 검증할 수 있는 수명주기 경계를 제공함**

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

## 검증 결과

- **provider fixture와 contract test가 GitHub blocked와 GitLab ready·pending 변환을 검증함**
- **HTTP 경계 test가 권한 부족과 rate limit을 `unknown`으로 보존하는지 검증함**
- **UI test가 blocked 원인·capability와 unknown 상태를 표시하는지 검증함**
- **selection sequence test가 이전 선택과 계정 전환 응답을 폐기하는지 검증함**
- **Hosting 관련 4개 test 파일의 32개 test가 통과함**

## 후속 범위

- **GitHub required checks와 branch protection의 개별 상세는 별도 API 조회가 추가될 때 capability를 확장할 수 있음**
- **자동 polling은 창 가시성·rate limit 예산·사용자 refresh 정책이 확정될 때 추가할 수 있음**
- **merge와 검사 재실행 mutation은 이번 read-only 범위에 포함하지 않음**
