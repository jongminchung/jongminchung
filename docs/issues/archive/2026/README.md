# 2026년 완료 이슈 아카이브

- 이 디렉터리는 2026년에 완료된 OSS 기반 제품·유지보수 개선 이슈의 결정과 검증 근거를 보존함
- 실행 가능한 backlog는 상위 [이슈 대시보드](../../README.md)에서 관리함

## 핵심 요약

- **일반 완료 이슈 26건과 선행 범위를 완료한 `0027` 한 건을 보관함**
- **아카이브 파일은 구현 결과·비채택 선택지·검증 명령을 추적하기 위한 완료 기록임**
- **현재 운영 계약의 기준은 관련 코드·테스트·ADR·운영 문서이며 이슈 파일 자체가 아님**
- **아카이브 이슈에서 추가 작업이 발견되면 상태를 되돌리지 않고 새로운 번호의 이슈로 분리함**
- **`0027`에서 보류된 updater 운영 범위는 활성 이슈 `0031`로 분리함**

## 프론트엔드와 디자인 시스템

- [`0002`: shadcn upstream 차이와 스타일 사용 방식 점검](0002-shadcn-upstream-audit.md)
- [`0003`: Formbricks 방식의 component 상태 fixture 도입](0003-formbricks-component-state-fixtures.md)
- [`0004`: Documenso 방식의 primitive와 제품 component 계층 정리](0004-documenso-ui-layering.md)
- [`0005`: Midday 방식의 복합 제품 component 분해](0005-midday-composite-components.md)
- [`0008`: 프론트엔드 JavaScript와 CSS 성능 예산 도입](0008-frontend-bundle-budgets.md)
- [`0009`: 접근성 환경 matrix 검증 보강](0009-accessibility-environment-matrix.md)
- [`0019`: 다중 도메인 OG 이미지와 Next Image 회귀 해소](0019-next-image-multidomain-og-regression.md)
- [`0020`: Web과 UI package의 개발·빌드 소비 계약 정리](0020-web-ui-package-development-contract.md)
- [`0021`: React compiler lint 대응의 상태 계약 회귀 보강](0021-react-compiler-remediation-state-contract.md)
- [`0030`: React 19.2·Compiler 1.0·Cache Components 적용 검토](0030-react-19-2-compiler-and-cache-components-adoption.md)

## Tooling과 릴리스

- [`0006`: 릴리스 workflow와 계약 테스트의 불일치 해소](0006-release-workflow-contract-drift.md)
- [`0007`: Web 앱의 CI 검증 공백 해소](0007-web-ci-parity.md)
- [`0010`: 의존성 갱신 lane과 검증 범위 분리](0010-dependency-update-lanes.md)
- [`0014`: 패키징된 Electron 앱의 smoke test와 릴리스 신뢰성 보강](0014-packaged-app-smoke-and-release-trust.md)
- [`0027`: 서명된 데스크톱 업데이트 채널 도입 준비](0027-signed-desktop-update-channel.md)
  - 완료 범위: 불변 SemVer release와 artifact identity 계약
  - 후속 범위: [활성 이슈 `0031`](../../0031-signed-desktop-updater.md)

## Electron 경계와 생명주기

- [`0012`: Electron 보안 경계와 권한 정책 감사](0012-electron-security-boundary-audit.md)
- [`0013`: Electron 프로세스 소유권과 IPC 계약 정리](0013-electron-process-ownership-and-ipc-contract.md)
- [`0015`: Git 작업 상태와 실패 복구 계약 통합](0015-git-operation-resilience-and-recovery.md)
- [`0016`: Electron 창 생명주기와 deep-link 준비도 보강](0016-desktop-lifecycle-and-deeplink-readiness.md)
- [`0017`: 로컬 데이터 migration과 privacy inventory 정리](0017-local-data-migration-and-privacy-inventory.md)
- [`0018`: Electron 리소스 생명주기와 누수 회귀 검증](0018-electron-resource-lifecycle-and-leak-tests.md)

## Git과 Hosting 제품 기능

- [`0022`: Hosting 변경 요청의 merge-readiness 요약](0022-hosting-merge-readiness-summary.md)
- [`0023`: 상황 기반 Git 업무 온보딩 도입](0023-contextual-git-workflow-onboarding.md)

## 기술 콘텐츠와 검색

- [`0024`: 기술 문서 freshness와 근거 검증 보고서 도입](0024-tech-content-freshness-evidence-report.md)
- [`0025`: 한영 기술 문서 검색 relevance benchmark 도입](0025-bilingual-search-relevance-benchmark.md)
- [`0028`: Web content runtime의 책임 경계와 fixture 검증 정리](0028-web-content-build-boundaries.md)
- [`0029`: 발행된 기술 문서의 TODO와 asset 준비 계약 정리](0029-published-content-todo-contract.md)

## 아카이브 운영 원칙

- **완료 파일의 번호와 파일명은 변경하지 않음**
- **새 요구는 기존 완료 상태를 되돌리지 않고 새로운 이슈로 생성함**
- **코드나 운영 계약이 바뀌면 canonical 문서를 먼저 갱신하고 필요한 경우 이슈에서 변경 근거를 연결함**
- **아카이브 이동으로 변경된 상대 링크는 저장소 루트를 기준으로 계속 유효하게 유지함**
