# OSS 기반 제품·유지보수 개선 이슈

- 이 디렉터리는 디자인 시스템, 기술 문서, Git workflow와 Electron 애플리케이션을 운영하는
  OSS 저장소를 분석하고, 현재 저장소의 제품 가치와 유지보수성을 높일 변경을 실행 가능한 이슈로 관리함
- 기준일은 2026-08-19이며 각 이슈는 참고 저장소의 현재 기본 branch와 현재 저장소의
  `DESIGN_SYSTEM.md`, `packages/ui`, Web, Git Client 구성을 비교함
- 외부 source를 직접 복사하는 작업은 각 저장소의 라이선스를 별도로 확인해야 하며, 기본 채택 대상은
  source가 아니라 구조·검증·운영 방식임

## 핵심 요약

- **전체 검사·문서 카드 이미지·Web source graph는 복구되었으며 Web CI의 원격 required check 연결이 남아 있음**
- **제품 가치 개선의 다음 우선순위는 Hosting merge-readiness, 상황 기반 Git 온보딩과 기술 문서 freshness 검증임**
- **한영 검색은 engine 교체 전에 relevance benchmark를 만들고 실제 사용자 질의로 비교해야 함**
- **OAuth 계정 연결과 desktop updater는 운영·보안·불변 release 전제가 충족된 뒤 진행할 조건부 과제임**
- **Electron 데이터 inventory와 Hosting 분리는 완료되었으며 package 보안 증거와 Git 작업 복구가 다음 경계 과제임**
- **Web content runtime은 실제 source·validation 경계만 남겼으며 발행 문서 TODO 계약까지 완료함**

## 참고한 OSS

### 프론트엔드와 디자인 시스템

- [`tailwindlabs/tailwindcss`](https://github.com/tailwindlabs/tailwindcss)
  - Tailwind CSS v4의 theme variable, utility 생성, source detection과 Vite integration의 upstream 기준으로 사용함
  - [`Tailwind CSS 문서`](https://tailwindcss.com/docs)를 실제 설정과 CSS 동작을 판단하는 공식 기준으로 함께 사용함
- [`shadcn-ui/ui`](https://github.com/shadcn-ui/ui)
  - semantic token, component source 관리와 consumer override 기준을 참고함
  - [`Theming`](https://ui.shadcn.com/docs/theming), [`Monorepo`](https://ui.shadcn.com/docs/monorepo),
    [`components.json`](https://ui.shadcn.com/docs/components-json)을 현재 UI package와 CLI 설정의 비교 기준으로 사용함
- [`OpenStatus`](https://github.com/openstatusHQ/openstatus) · [관련 이슈 0001](0001-openstatus-ui-registry.md)
  - Tailwind CSS v4·shadcn 모노레포와 UI package·registry 분리 방식을 참고함
- [`Formbricks`](https://github.com/formbricks/formbricks) · [관련 이슈 0003](0003-formbricks-component-state-fixtures.md)
  - 복잡한 component 상태를 source 인접 fixture로 관리하는 방식을 참고함
- [`Documenso`](https://github.com/documenso/documenso) · [관련 이슈 0004](0004-documenso-ui-layering.md)
  - primitive와 제품 workflow component의 계층 분리 방식을 참고함
- [`Midday`](https://github.com/midday-ai/midday) · [관련 이슈 0005](0005-midday-composite-components.md)
  - 데이터 중심 복합 component의 책임과 제품 수준 API 구성을 참고함
- [`Pagefind`](https://github.com/Pagefind/pagefind) · [관련 이슈 0025](0025-bilingual-search-relevance-benchmark.md)
  - metadata weighting, CJK segmentation과 정적 search index의 품질·비용 비교 기준을 참고함
- [`GitHub Docs`](https://github.com/github/docs)와 [`MDN content`](https://github.com/mdn/content) ·
  [관련 이슈 0024](0024-tech-content-freshness-evidence-report.md)
  - content lint의 severity와 source evidence를 이용한 문서 신뢰성 운영 방식을 참고함

### Electron과 데스크톱 애플리케이션

- [`electron/electron`](https://github.com/electron/electron)
  - [`Security`](https://github.com/electron/electron/blob/main/docs/tutorial/security.md)를 BrowserWindow·navigation·IPC 보안 감사의 기준으로 사용함
- [`desktop/desktop`](https://github.com/desktop/desktop)
  - Git 작업 상태, 오류 복구, OS 연동과 [`packaging`](https://github.com/desktop/desktop/blob/development/docs/technical/packaging.md) 구조를 참고함
- [`microsoft/vscode`](https://github.com/microsoft/vscode)
  - [`Source Code Organization`](https://github.com/microsoft/vscode/wiki/Source-Code-Organization/e7745b74f35efcff8a6a34780d21e0acb4528b53)과
    [`smoke test`](https://github.com/microsoft/vscode/blob/main/test/smoke/README.md)의 실행 환경 분리·생명주기 검증 방식을 참고함
- [`signalapp/Signal-Desktop`](https://github.com/signalapp/Signal-Desktop)
  - preload 표면 최소화, 민감 데이터 취급과 [`reproducible-builds`](https://github.com/signalapp/Signal-Desktop/tree/main/reproducible-builds)를 참고함
- [`mattermost/desktop`](https://github.com/mattermost/desktop)
  - single-instance, 창·세션 생명주기와 deep link 처리 방식을 참고함
- [`laurent22/joplin`](https://github.com/laurent22/joplin)
  - 로컬 데이터 migration과 [`privacy`](https://github.com/laurent22/joplin/blob/dev/readme/privacy.md) inventory 방식을 참고함
- [`Kong/insomnia`](https://github.com/Kong/insomnia)
  - [`DEVELOPMENT.md`](https://github.com/Kong/insomnia/blob/develop/DEVELOPMENT.md)에 기록된 main·renderer·CLI 경계와 cross-runtime 기술 부채를 반면교사로 참고함
- [`GitHub CLI`](https://github.com/cli/cli) · [관련 이슈 0022](0022-hosting-merge-readiness-summary.md)
  - PR check 상태를 사용자 판단 단위로 정규화하는 방식을 참고함
- [`Git Credential Manager`](https://github.com/git-ecosystem/git-credential-manager) ·
  [관련 이슈 0026](0026-hosting-oauth-account-onboarding.md)
  - browser·device OAuth, provider 감지와 system credential store 수명주기를 참고함

- **외부 source 복사보다 검증된 구조와 운영 계약을 선택적으로 채택함**
  - 저장소별 라이선스와 현재 저장소의 제품 요구를 구현 전에 다시 확인함
  - 장기간 운영된 OSS의 레거시 구조나 프레임워크 선택을 그대로 복제하지 않음

## 이슈 목록

- [0001: OpenStatus의 UI package와 registry 운영 방식 검토](0001-openstatus-ui-registry.md)
  - 상태: 조건부 보류
  - 우선순위: P3
  - 결론: 현재 package 구조는 유지하고 registry는 도입 조건이 충족될 때만 pilot 수행
- [0002: shadcn upstream 차이와 스타일 사용 방식 점검](0002-shadcn-upstream-audit.md)
  - 상태: 제안
  - 우선순위: P1
  - 결론: 공개 API 변경 없이 primitive별 upstream 차이와 consumer override 점검
- [0003: Formbricks 방식의 component 상태 fixture 도입](0003-formbricks-component-state-fixtures.md)
  - 상태: 진행 중
  - 우선순위: P1
  - 결론: 개발 전용 상태 surface를 추가했으며 light·dark screenshot과 overlay matrix가 남아 있음
- [0004: Documenso 방식의 primitive와 제품 component 계층 정리](0004-documenso-ui-layering.md)
  - 상태: 제안
  - 우선순위: P2
  - 결론: 공용 package를 확대하지 않고 Git Client 제품 component를 기능 단위로 정리
- [0005: Midday 방식의 복합 제품 component 분해](0005-midday-composite-components.md)
  - 상태: 완료
  - 우선순위: P2
  - 결론: `HostingPanel`의 화면과 비동기 controller를 분리하고 package UI 회귀를 고정함
- [0006: 릴리스 workflow와 계약 테스트의 불일치 해소](0006-release-workflow-contract-drift.md)
  - 상태: 진행 중
  - 우선순위: P0
  - 결론: stale assertion을 observable workflow 계약으로 교체해 전체 검사를 복구했으며 publish 후 integrity 검증은 남아 있음
- [0007: Web 앱의 CI 검증 공백 해소](0007-web-ci-parity.md)
  - 상태: 진행 중
  - 우선순위: P0
  - 결론: workflow 구현은 완료되었으며 원격 실행 확인과 required check 연결이 남아 있음
- [0008: 프론트엔드 JavaScript와 CSS 성능 예산 도입](0008-frontend-bundle-budgets.md)
  - 상태: 제안
  - 우선순위: P1
  - 결론: 두 앱의 production asset baseline과 PR별 증감 report 도입
- [0009: 접근성 환경 matrix 검증 보강](0009-accessibility-environment-matrix.md)
  - 상태: 완료
  - 우선순위: P1
  - 결론: Web reflow와 Git Client forced colors·reduced motion·150% zoom 대표 matrix를 검증함
- [0010: 의존성 갱신 lane과 검증 범위 분리](0010-dependency-update-lanes.md)
  - 상태: 제안
  - 우선순위: P2
  - 결론: framework·UI·desktop·test·tooling update를 분리하고 검증 조합 연결
- [0011: 미사용 코드·export·dependency audit 도입 검토](0011-unused-code-and-dependency-audit.md)
  - 상태: 제안
  - 우선순위: P2
  - 결론: report-only pilot으로 entry 정확도와 false positive를 검증한 뒤 gate 여부 결정
- [0012: Electron 보안 경계와 권한 정책 감사](0012-electron-security-boundary-audit.md)
  - 상태: 완료
  - 우선순위: P0
  - 결론: navigation·IPC·permission·CSP·QA 비활성화·package trust를 감사표와 자동 검증으로 고정함
- [0013: Electron 프로세스 소유권과 IPC 계약 정리](0013-electron-process-ownership-and-ipc-contract.md)
  - 상태: 진행 중
  - 우선순위: P1
  - 결론: runtime import 경계와 procedure별 명시적 authorization을 고정했으며 취소·dispose 계약이 남아 있음
- [0014: 패키징된 Electron 앱의 smoke test와 릴리스 신뢰성 보강](0014-packaged-app-smoke-and-release-trust.md)
  - 상태: 제안
  - 우선순위: P1
  - 결론: 기존 package 검증을 실제 배포 artifact와 clean-profile 사용자 여정까지 연결
- [0015: Git 작업 상태와 실패 복구 계약 통합](0015-git-operation-resilience-and-recovery.md)
  - 상태: 제안
  - 우선순위: P1
  - 결론: 분산된 Git 작업의 progress·cancel·retry·recovery를 공통 상태 모델과 회귀 matrix로 관리
- [0016: Electron 창 생명주기와 deep-link 준비도 보강](0016-desktop-lifecycle-and-deeplink-readiness.md)
  - 상태: 제안
  - 우선순위: P2
  - 결론: OS별 창·종료·재실행 계약을 검증하고 deep link는 제품 요구가 생길 때 안전하게 확장
- [0017: 로컬 데이터 migration과 privacy inventory 정리](0017-local-data-migration-and-privacy-inventory.md)
  - 상태: 완료
  - 우선순위: P2
  - 결론: migration 원본 보존과 로컬 데이터·network privacy inventory를 완료함
- [0018: Electron 리소스 생명주기와 누수 회귀 검증](0018-electron-resource-lifecycle-and-leak-tests.md)
  - 상태: 제안
  - 우선순위: P2
  - 결론: utility·watcher·PTY·IPC·창의 해제 계약을 반복 실행하는 package test로 증명
- [0019: 다중 도메인 OG 이미지와 Next Image 회귀 해소](0019-next-image-multidomain-og-regression.md)
  - 상태: 완료
  - 우선순위: P0
  - 결론: 공개 OG 경로와 natural size를 복구하고 Web E2E 50개로 고정함
- [0020: Web과 UI package의 개발·빌드 소비 계약 정리](0020-web-ui-package-development-contract.md)
  - 상태: 완료
  - 우선순위: P1
  - 결론: source-first module graph로 통합하고 clean dist build와 UI Fast Refresh를 확인함
- [0021: React compiler lint 대응의 상태 계약 회귀 보강](0021-react-compiler-remediation-state-contract.md)
  - 상태: 완료
  - 우선순위: P1
  - 결론: route sheet·theme·diagram identity와 같은 element 수의 두 scene 전환 fixture를 완료함
- [0022: Hosting 변경 요청의 merge-readiness 요약](0022-hosting-merge-readiness-summary.md)
  - 상태: 제안
  - 우선순위: P1
  - 결론: CI·필수 검사·리뷰·충돌·branch 상태를 provider 공통 read model과 다음 행동으로 연결
- [0023: 상황 기반 Git 업무 온보딩 도입](0023-contextual-git-workflow-onboarding.md)
  - 상태: 제안
  - 우선순위: P1
  - 결론: repository 상태별 task를 기존 command와 연결해 첫 push·변경 요청 여정을 안내
- [0024: 기술 문서 freshness와 근거 검증 보고서 도입](0024-tech-content-freshness-evidence-report.md)
  - 상태: 제안
  - 우선순위: P1
  - 결론: 검증일·공식 출처·version drift를 scheduled report와 severity 기반 review queue로 관리
- [0025: 한영 기술 문서 검색 relevance benchmark 도입](0025-bilingual-search-relevance-benchmark.md)
  - 상태: 제안
  - 우선순위: P2
  - 결론: 대표 한영 질의의 top-3 적중률과 비용을 기준으로 현재 검색과 Pagefind pilot을 비교
- [0026: Hosting 계정의 OAuth 기반 연결 도입 검토](0026-hosting-oauth-account-onboarding.md)
  - 상태: 조건부 제안
  - 우선순위: P2
  - 결론: provider·OAuth App 운영 전제를 확인한 뒤 browser 인증과 PAT fallback을 함께 제공
- [0027: 서명된 데스크톱 업데이트 채널 도입 준비](0027-signed-desktop-update-channel.md)
  - 상태: 조건부 제안
  - 우선순위: P2
  - 결론: 불변 semantic version release와 package trust chain을 먼저 만든 뒤 stable updater를 연결
- [0028: Web content runtime의 책임 경계와 fixture 검증 정리](0028-web-content-build-boundaries.md)
  - 상태: 완료
  - 우선순위: P1
  - 결론: 실제 runtime의 source·validation만 분리하고 도달 불가능한 CLI·artifact·package audit를 제거함
- [0029: 발행된 기술 문서의 TODO와 asset 준비 계약 정리](0029-published-content-todo-contract.md)
  - 상태: 완료
  - 우선순위: P1
  - 결론: stale TODO와 404 sample 링크를 제거하고 published MDX comment 검증을 추가함

## 권장 실행 순서

- **0단계는 완료된 0019와 0020을 유지하고 0007의 원격 연결을 마무리함**
  - 문서 카드 이미지와 Web source graph의 회귀를 현재 E2E와 build로 유지함
  - GitHub Actions의 `Web verify`를 required check로 연결함
- **1단계는 완료된 0021의 상태 계약을 유지하며 0002·0003을 함께 진행함**
  - compiler lint 대응 상태 회귀와 interaction fixture를 회귀 기준으로 사용함
  - upstream 차이에서 확인된 실제 동작과 상태를 기존 테스트 체계로 증명할 수 있음
  - 공용 package export나 variant 계약을 바꾸지 않고도 시작할 수 있음
- **2단계는 0008과 0009를 진행함**
  - production asset 크기와 접근성 환경 회귀를 측정 가능한 기준으로 전환함
  - Web 접근성 test는 유지하고 Git Client matrix와 bundle report를 보강함
- **2.5단계는 완료된 0028·0029의 경계에서 0024·0025를 확장함**
  - freshness는 validation, 검색 benchmark는 repository 경계를 사용함
  - consumer가 없는 generated artifact pipeline을 다시 만들지 않음
- **3단계는 완료된 0005의 경계를 유지하면서 0004를 작은 기능 단위로 진행함**
  - `HostingPanel`의 controller·render 분리와 package 회귀를 다음 제품 component의 비교 기준으로 사용함
  - 파일 이동만 수행하지 않고 변경 영향 범위가 줄어드는 제품 surface만 선택함
- **4단계는 0010과 0011을 진행함**
  - dependency update와 dead-code audit를 report 중심으로 도입함
  - false positive와 검증 비용이 안정된 뒤에만 CI gate로 승격함
- **5단계는 0001의 도입 조건을 주기적으로 확인함**
  - 외부 소비자, 복사 배포, 독립 block 제공 요구가 생기기 전에는 registry build를 추가하지 않음

## Electron 권장 실행 순서

- **1단계는 0012를 먼저 진행함**
  - Electron 공식 보안 기준과 기존 방어 설정의 대응표를 만들고 누락된 우회 경로를 먼저 차단함
- **2단계는 0013과 0015를 진행함**
  - 프로세스 소유권과 Git 작업 상태 계약을 정리해 이후 테스트가 의존할 안정된 경계를 만듦
- **3단계는 0014와 0018을 함께 진행함**
  - 실제 package의 사용자 여정과 반복 생명주기에서 보안·종료·리소스 해제 계약을 검증함
- **4단계는 완료된 0017의 데이터 계약을 유지하면서 0016을 진행함**
  - OS별 창 동작을 정리하고 deep link는 명시적 제품 요구가 있을 때만 활성화함

## 제품 가치 개선 권장 실행 순서

- **1단계는 0022와 0023의 제품 contract를 정의함**
  - Hosting 변경 요청의 병합 준비 상태와 repository별 다음 작업을 읽기 전용 모델로 먼저 고정함
  - 0013의 IPC 경계와 0015의 Git 작업 상태를 재사용하고 새로운 mutation 경로를 만들지 않음
- **2단계는 0024의 문서 freshness report를 도입함**
  - 0007의 Web CI가 안정된 뒤 scheduled report로 시작함
  - 외부 source 오류와 검증 기한 초과는 초기에는 배포 차단이 아닌 review 대상으로 관리함
- **3단계는 0025의 검색 benchmark를 수행함**
  - 0024에서 정리된 metadata와 실제 한영 질의를 사용해 현재 검색과 OSS pilot을 비교함
  - 선택한 구현의 index·bundle 비용은 0008의 성능 예산과 연결함
- **4단계는 0026의 OAuth feasibility를 검토함**
  - 0017의 credential·privacy inventory와 provider별 운영 주체가 확정된 뒤 한 provider로 pilot함
  - 조건이 충족되지 않으면 PAT scope 안내와 오류 복구만 개선함
- **5단계는 0027의 update channel을 준비함**
  - 0006의 release 계약과 0014의 package trust를 먼저 완료함
  - 고정 `1.0.0` 교체 정책을 불변 semantic version release로 전환한 뒤에만 updater를 활성화함
