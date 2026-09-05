# OSS 기반 제품·유지보수 개선 이슈

- 이 디렉터리는 OSS 저장소를 분석해 현재 저장소의 제품 가치와 유지보수성을 높일 작업을 관리함
- 진행 중이거나 재개 조건을 기다리는 이슈만 이 디렉터리의 최상위에 유지함
- 완료된 이슈는 연도별 `archive`로 이동하고 구현 근거와 검증 기록으로 보존함

## 핵심 요약

- **현재 구현·검증 작업은 `0032`–`0038`·`0041` 8건이며 구현 완료·반영 대기를 구분함**
- **조건부 보류 이슈는 `0001`·`0011`·`0039` 3건이며 명시된 재개 조건이 충족될 때만 작업함**
- **완료 이슈 12건은 `archive/2026`에 보관함**
- **지속적으로 적용할 계약은 코드·테스트·ADR·운영 문서가 소유하고 이슈는 결정과 검증 근거를 보존함**
- **완료와 보류가 섞인 작업은 완료된 범위를 보관하고 남은 범위를 별도 이슈로 분리함**

## 상태별 관리 원칙

- **진행 중 이슈는 현재 구현 또는 외부 연결 작업이 남아 있는 작업 단위임**
    - 우선순위와 완료 조건을 기준으로 실행함
    - 구현만 끝난 경우 원격 검증과 운영 연결까지 완료 조건에 포함함
- **조건부 보류 이슈는 구현 계획이 아니라 재개 조건을 감시하는 작업 단위임**
    - 조건이 충족되지 않으면 dependency·workflow·운영 표면을 추가하지 않음
    - 조건이 충족되면 기준일과 근거를 갱신한 뒤 구현 범위를 확정함
- **완료 이슈는 결과와 검증을 기록한 뒤 연도별 archive로 이동함**
    - 반복적으로 지켜야 하는 규칙은 canonical 문서나 자동 검증으로 승격함
    - archive의 이슈 번호와 파일명은 추적성을 위해 유지함

## 진행 중 작업

- [`0032`: Web 검색 runtime과 benchmark 실행 경계 분리](0032-web-search-runtime-benchmark-boundary.md)
    - 상태: 구현 완료·반영 대기
    - 우선순위: P1
    - 구현 범위: 제품 검색 module과 benchmark runner 분리, 실제 corpus test의 integration 경계 정리
- [`0033`: Investment content의 obsolete 생성 pipeline 제거](0033-investment-content-obsolete-generation-pipeline.md)
    - 상태: 구현 완료·반영 대기
    - 우선순위: P1
    - 구현 범위: runtime source loader 분리, consumer 없는 generated manifest·loader·CLI 제거
- [`0034`: Web multi-site URL과 feed 계약 통합](0034-web-multisite-url-feed-contract.md)
    - 상태: 진행 중
    - 우선순위: P2
    - 구현 범위: site origin 단일 기준과 Tech·Invest RSS protocol helper 도입
- [`0035`: Web test 의도와 corpus fixture 경계 정리](0035-web-test-intent-and-corpus-fixtures.md)
    - 상태: 진행 중
    - 우선순위: P3
    - 구현 범위: 의미가 불명확한 test 이름과 실제 corpus에 결합된 알고리즘 assertion 정리
- [`0036`: Tech 초안의 공개 경계 차단](0036-tech-draft-publication-boundary.md)
    - 상태: 구현 완료·반영 대기
    - 우선순위: P1
    - 구현 범위: validation용 전체 collection과 published public collection 분리, draft route·discovery 차단
- [`0037`: Web 초기 폰트 전송량과 예산 정리](0037-web-initial-font-transfer-budget.md)
    - 상태: 구현 완료·반영 대기
    - 우선순위: P2
    - 구현 범위: 2.06MB 공통 Pretendard preload 축소와 locale별 font 전송 budget 도입
- [`0038`: Web 응답 보안 헤더와 배포 소유권 정리](0038-web-response-security-header-contract.md)
    - 상태: 진행 중
    - 우선순위: P2
    - 구현 범위: application·Ingress header owner 확정, 정적 방어 헤더와 CSP 단계 분리
- [`0041`: OpenAI 공개 참조 디자인 시스템을 Web 세 사이트에 적용](0041-web-openai-reference-design-system-application.md)
    - 상태: 진행 중
    - 우선순위: P2
    - 구현 범위: 공용 token·primitive 유지보수 경계, Home·Tech·Invest 표현형, 접근성·visual·release 품질 gate

## 조건부 보류 작업

- [`0001`: OpenStatus의 UI package와 registry 운영 방식 검토](0001-openstatus-ui-registry.md)
    - 상태: 조건부 보류
    - 우선순위: P3
    - 재개 조건: 외부 저장소 consumer·복사 설치·공개 install block 요구 중 하나의 발생
- [`0011`: 미사용 코드·export·dependency audit 도입 검토](0011-unused-code-and-dependency-audit.md)
    - 상태: 조건부 보류
    - 우선순위: P2
    - 재개 조건: Next route·generated content entry를 좁은 설정으로 모델링할 수 있는 audit 정확도의 확보
- [`0039`: Web Tech 문서의 Starlight 전환 영향 검토](0039-web-tech-starlight-migration-assessment.md)
    - 상태: 조건부 보류
    - 우선순위: P3
    - 재개 조건: 별도 Tech 배포·Starlight 표준 UI·Home 최신 글 data boundary·locale runtime 책임의 합의

## 완료 이슈 아카이브

- **2026년 완료 이슈 12건은 [2026년 완료 이슈 아카이브](archive/2026/README.md)에서 관리함**
    - 구현 결과·채택하지 않은 선택지·검증 명령을 향후 회귀 분석 근거로 보존함

## 권장 실행 순서

- **후속 운영 확인은 월요일 scheduled content evidence의 첫 성공과 `content-evidence` artifact 생성 확인임**
- **이미 구현된 `0032`·`0033`·`0036`의 반영 확인과 `0037`의 전송량·화면 검증을 먼저 마무리하고, `0034`·`0038`·`0035`·`0041`의 남은 범위를 진행함**
- **그 밖의 구현 작업은 조건부 이슈의 재개 조건 발생 여부를 제품 요구와 운영 환경 변화 시점에 확인한 뒤 결정함**
- **Starlight 전환은 `0039`의 네 가지 재개 조건을 합의한 뒤 isolated pilot으로 검색·URL·배포 계약을 먼저 검증함**
- **새 이슈는 하나의 완료 상태만 갖도록 범위를 나누고 혼합 상태가 생기면 후속 이슈로 분리함**
