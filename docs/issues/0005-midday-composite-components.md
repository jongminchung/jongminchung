# Issue 0005: Midday 방식의 복합 제품 component 분해

- 상태: 완료
- 우선순위: P2
- 기준일: 2026-08-19
- 참고 저장소: [midday-ai/midday](https://github.com/midday-ai/midday)
- 주요 참고 위치:
  [packages/ui](https://github.com/midday-ai/midday/tree/main/packages/ui),
  [package exports](https://github.com/midday-ai/midday/blob/main/packages/ui/package.json),
  [UI globals](https://github.com/midday-ai/midday/blob/main/packages/ui/src/globals.css)

## 핵심 요약

- **Midday는 date range, currency input, editor와 chart 같은 데이터 중심 복합 component를 제품 수준 API로 캡슐화함**
- **component별 explicit export와 controlled input 경계는 참고 가치가 있음**
- **marketing animation과 제품 component까지 공용 UI package에 포함한 넓은 소유 범위는 채택하지 않음**
- **현재 저장소에는 Midday의 구조를 공용 package가 아니라 앱 소유 복합 surface에 적용하는 것이 적절함**
- **첫 대상인 `HostingPanel`의 화면과 비동기 controller 분리 및 package UI 회귀 검증을 완료함**

## 진행 현황

- **`HostingPanel`은 제품 화면 구조만 소유하도록 축소됨**
  - account toolbar, 연결, notice, composer와 list·detail 배치를 직접 표현함
  - 불필요한 `cn()` 호출과 완료 응답별 반복 분기를 제거함
- **hosting 비동기 상태와 작업은 전용 controller hook으로 이동함**
  - account 복원·연결·삭제
  - request 목록·상세·review·comment·viewed 상태
  - remote URL 좌표 추론과 provider 판정
- **실제 Electron package에서 account 복원과 요청 화면 회귀를 검증함**
  - 저장소와 GitHub·GitLab account metadata를 격리 profile에서 복원함
  - empty detail에서 GitHub 요청 목록을 불러오고 selection 상태로 전환함
  - file·timeline·provider별 viewed 응답은 기존 hosting foundation 계약 테스트가 담당함

## 참고 저장소에서 확인한 구조

- **복합 입력과 데이터 표현을 하나의 직접 import 가능한 component로 제공함**
  - currency input, date range picker, combobox와 editor가 독립 subpath를 가짐
  - consumer는 package root보다 필요한 component path를 선택할 수 있음
  - primitive 조합과 제품 수준 interaction을 component 내부에서 캡슐화함
- **theme가 기본 semantic token과 chart 전용 token을 함께 제공함**
  - 일반 surface와 action token이 있음
  - chart grid, axis, actual, forecast와 pattern 역할이 별도 token으로 표현됨
- **공용 package 범위가 넓음**
  - primitive 외에 plan card, animation, demo rail과 marketing용 표현도 포함함
  - 여러 변경 이유가 하나의 package release와 dependency graph에 결합될 가능성이 있음

## 현재 저장소와 비교

- **현재 `@jongminchung/ui` export 경계는 이미 충분히 명시적임**
  - component별 subpath import를 사용함
  - root barrel을 제공하지 않음
  - source-first와 외부 ESM build를 함께 지원함
- **제품 token 소유권은 현재 저장소가 더 엄격함**
  - terminal, repository 상태와 Git Client layer token은 앱 theme가 소유함
  - Web의 marketing과 documentation theme도 앱에 남음
  - Midday처럼 chart·product token을 공용 theme에 모두 합치지 않음
- **일부 앱 surface의 orchestration은 분리되었지만 후속 검증이 필요함**
  - `HostingPanel`은 화면 구조를 소유하고 hosting controller가 account와 요청 상태를 소유함
  - account·composer·list·detail section은 hosting 하위 component로 유지됨
  - `RepositoryInspectorDialog`는 tree, file preview, history와 blame surface를 함께 조정함
  - CSS 구조는 최근 앱 전용 stylesheet로 분리됐지만 state와 render 책임은 더 나눌 수 있음

## 채택할 내용

- **복합 제품 component에 명확한 entry API를 유지함**
  - 외부 consumer가 domain state의 내부 표현을 알 필요가 없도록 함
  - controlled value, selection, busy, error와 action callback을 구분함
  - 접근 가능한 label과 empty·loading 상태를 API 일부로 취급함
- **큰 surface 내부를 앱 소유 section으로 분해함**
  - orchestration entry
  - account 또는 filter control section
  - composer section
  - list와 detail section
  - loading·notice·empty state
- **복합 component와 semantic product token을 함께 검토함**
  - chart나 repository처럼 제품 renderer 의미가 있는 token은 앱에 유지함
  - 공용 primitive token으로 이동하지 않음

## 채택하지 않을 내용

- **복합 제품 component를 `packages/ui`에 추가하지 않음**
- **animation과 marketing presentation을 공용 UI package export로 만들지 않음**
- **Midday의 Tailwind CSS v3 globals와 package 구성을 그대로 복제하지 않음**
- **파일 크기만을 이유로 의미 없는 wrapper를 만들지 않음**
- **현재 공용 UI export map이나 공개 prop 계약을 변경하지 않음**

## 실행 작업

- **`HostingPanel`을 첫 pilot으로 분석함**
  - state orchestration과 presentational section을 구분함
  - Electron runtime과 hosting service 경계를 entry에 유지함
  - account bar, request composer, list/detail layout의 독립 변경 이유를 확인함
- **검증 가능한 단위만 component로 추출함**
  - 독립 prop과 semantic role이 있는 section
  - 별도 loading·empty·error 상태를 가진 section
  - 다른 section의 내부 state를 직접 변경하지 않는 section
- **pilot 결과로 다음 대상 확장 여부를 결정함**
  - `RepositoryInspectorDialog`
  - `ChangesWorkspace`
  - 확장 전에 코드 감소보다 변경 영향 범위가 실제로 줄었는지 확인함

## 완료 조건

- **`HostingPanel`의 외부 prop과 사용자 동작이 유지됨**
- **orchestration과 render section의 책임이 구분됨**
- **추출 component가 hosting domain 밖으로 일반화되지 않음**
- **새 root barrel과 공용 package export가 추가되지 않음**
- **busy·notice·empty·selection 상태가 기존과 동일하게 동작함**
- **분해 후 source 탐색과 테스트 대상이 더 명확해졌는지 PR에서 평가함**

## 검증

- **hosting 관련 정적·동작 검증을 실행함**
  - `pnpm --filter @jongminchung/git-client run typecheck`
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run build`
  - hosting surface가 포함된 Playwright test 또는 필요한 fixture 보강
  - 최종 `pnpm run check`
- **구조 경계를 검색으로 확인함**
  - 새 component가 `packages/ui`에서 import되지 않는지 확인함
  - hosting 내부 module이 다른 제품 feature로 확산되지 않는지 확인함
  - 이전 monolithic selector와 import가 남지 않는지 확인함

## 구현 결과

- **`HostingPanel`은 화면 composition만 소유하고 `useHostingPanelController`가 비동기 상태를 소유함**
- **package hosting test가 account 복원·empty·목록·selection 전환을 실제 preload와 main handler를 통해 검증함**
- **제품 component는 Git Client 내부에 유지되며 공용 UI export와 root barrel을 추가하지 않음**
