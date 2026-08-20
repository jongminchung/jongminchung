# Issue 0035: Web test 의도와 corpus fixture 경계 정리

- 상태: 진행 중
- 우선순위: P3
- 기준일: 2026-08-20
- 영향 범위:
  [document tests](../../apps/web/lib/documents.test.ts),
  [site routing tests](../../apps/web/lib/site-routing.test.ts),
  [proxy tests](../../apps/web/proxy.test.ts),
  [Tech UI store tests](<../../apps/web/app/(tech)/_components/TechUiProvider.test.ts>),
  [Tech navigation tests](<../../apps/web/app/(tech)/_components/tech-navigation.test.ts>)

## 핵심 요약

- **일부 Web test 이름이 assertion의 조건과 기대 결과를 설명하지 못함**
- **문서 정렬 test가 실제 Deep Dive 문서 29개 ID 전체를 고정해 콘텐츠 추가와 알고리즘 변경을 같은 실패로 처리함**
- **규칙 검증은 작은 fixture로, 실제 corpus 연결은 좁은 integration smoke로 분리해야 함**
- **제품 동작이나 coverage threshold를 변경하지 않고 실패 진단과 변경 내성을 높이는 작업임**
- **광범위한 snapshot 재생성이 아니라 의미가 불명확한 test와 corpus 결합만 대상으로 함**

## 현재 문제와 근거

- **test 이름과 검증 내용의 연결이 약한 사례가 있음**
  - `업데이트 휴가 휴가 목록`
  - `공급자 전원 상태를 펀치함`
  - `제조원`
  - `표시되지 않고 외부 외부를 생성함`
  - 실패 시 이름만으로 깨진 제품 계약을 판단하기 어려움
- **실제 corpus test가 알고리즘 세부 계약까지 소유함**
  - `documents.test.ts`가 한국어 Deep Dive 문서 29개의 전체 순서를 ID 배열로 고정함
  - 정상적인 문서 추가·삭제·날짜 변경도 같은 배열 failure를 발생시킴
  - 최신순·동률 order·ID tie-break 규칙을 작은 fixture로 직접 설명하지 않음
- **unit과 integration 책임이 test data 선택에서 구분되지 않음**
  - ranking 함수의 pure behavior와 실제 repository content의 현재 결과가 같은 test file에 존재함
  - corpus 변경과 ranking 회귀의 원인을 분리하기 어려움

## 채택할 내용

- **test 이름을 조건과 관찰 결과 중심으로 정리함**
  - `[성공] 저장된 locale을 Accept-Language보다 우선함`
  - `[실패] 알 수 없는 host와 내부 route 직접 접근을 거부함`
  - `[성공] 같은 section에서 최신 update와 order로 문서를 정렬함`
- **문서 정렬과 related ranking을 작은 fixture로 검증함**
  - update date 우선순위
  - 같은 날짜의 navigation order
  - ID tie-break
  - shared tag와 same-section fallback
- **실제 corpus 검증은 제품 연결 smoke로 제한함**
  - locale별 section이 비어 있지 않음
  - URL과 document ID가 중복되지 않음
  - 대표 문서가 검색·navigation·related 결과에 포함됨
- **기존 assertion이 나타내는 제품 계약을 먼저 확인한 뒤 이름만 변경함**

## 채택하지 않을 내용

- **모든 test를 동일한 문장 template로 기계적으로 변경하지 않음**
- **실제 corpus 기반 검증을 전부 제거하지 않음**
- **정렬·검색·related document baseline을 느슨하게 만들어 회귀를 숨기지 않음**
- **Playwright visual snapshot을 이 이슈에서 다시 생성하지 않음**
- **CI workflow와 test runner configuration을 변경하지 않음**

## 실행 작업

- **의미가 불명확한 Web unit·integration test 이름을 inventory함**
- **각 test의 assertion을 기준으로 조건과 기대 결과를 다시 작성함**
- **문서 정렬과 related ranking용 작은 metadata fixture를 추가함**
- **실제 29개 문서 ID 전체 배열 assertion을 규칙 fixture와 corpus smoke로 분리함**
- **변경 전후 test count와 제품 assertion이 유지되는지 확인함**

## 완료 조건

- **대상 test 이름만 읽어도 입력 조건과 기대 결과를 설명할 수 있음**
- **새 문서 추가가 정렬 알고리즘 fixture의 무관한 수정을 요구하지 않음**
- **정렬과 ranking tie-break가 작은 fixture에서 명시적으로 검증됨**
- **실제 content repository와 route를 사용하는 smoke test가 유지됨**
- **기존 unit·integration·browser 동작 검증 수가 감소하지 않음**

## 검증

- `pnpm --filter @jongminchung/web run test`
- `pnpm run test:unit`
- `pnpm run test:integration`
- 관련 Web Playwright test
- `pnpm --filter @jongminchung/web run typecheck`
- `git diff --check`
