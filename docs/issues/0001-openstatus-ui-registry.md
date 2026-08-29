# Issue 0001: OpenStatus의 UI package와 registry 운영 방식 검토

- 상태: 조건부 보류
- 최근 재확인: 2026-08-20
- 우선순위: P3
- 기준일: 2026-08-19
- 참고 저장소: [openstatusHQ/openstatus](https://github.com/openstatusHQ/openstatus)
- 주요 참고 위치:
  [packages/ui](https://github.com/openstatusHQ/openstatus/tree/main/packages/ui),
  [components.json](https://github.com/openstatusHQ/openstatus/blob/main/packages/ui/components.json),
  [globals.css](https://github.com/openstatusHQ/openstatus/blob/main/packages/ui/src/globals.css),
  [registry.json](https://github.com/openstatusHQ/openstatus/blob/main/packages/ui/registry.json)

## 핵심 요약

- **OpenStatus는 현재 저장소와 가장 유사한 Tailwind CSS v4·shadcn 모노레포 사례임**
- **공용 UI source와 배포용 shadcn registry를 분리한 점은 장기적으로 채택 가치가 있음**
- **현재 저장소는 내부 source-first 소비만으로 충분하므로 registry build를 즉시 추가할 이유가 부족함**
- **도입 시 primitive 재배포가 아니라 외부에서 복사 설치할 제품 block만 registry 대상으로 제한해야 함**
- **현재는 도입 조건과 pilot 범위를 남기고 build pipeline 추가를 보류하는 것이 적절함**

## 참고 저장소에서 확인한 구조

- **`@openstatus/ui`는 component, block, custom component, hook과 전역 CSS를 명시적인 subpath로 공개함**
  - workspace에서는 TypeScript source를 직접 소비함
  - registry build는 package build와 별도 script로 수행함
  - package의 일반 build는 별도 산출물을 만들지 않는 source-first 모델임
- **Tailwind CSS v4 진입점이 theme provider와 utility adapter를 함께 관리함**
  - `@source`로 UI package source를 등록함
  - `@theme inline`으로 `background`, `primary`, `success`, `warning`, `info` 같은 의미를 노출함
  - 실제 light·dark 값은 CSS variable provider에 둠
- **registry는 설치 항목의 유형과 의존성을 machine-readable하게 표현함**
  - `registry:hook`, `registry:lib`, `registry:ui`, `registry:block`을 구분함
  - package dependency와 registry dependency를 각 항목에 선언함
  - status domain의 조합 component를 primitive와 다른 block으로 분류함

## 현재 저장소와 비교

- **현재 `@jongminchung/ui`도 핵심 구조를 이미 충족함**
  - 공용 primitive와 제품 composition의 소유권이 분리됨
  - Tailwind CSS v4 진입점과 `@source`, token adapter, neutral provider가 분리됨
  - component와 CSS를 명시적인 subpath로 공개함
  - workspace의 `source` 조건과 외부 consumer용 ESM·declaration 조건을 함께 제공함
- **현재 저장소에는 shadcn registry가 없음**
  - Web은 같은 monorepo에서 package source를 직접 소비함
  - 외부 프로젝트가 block을 복사 설치해야 하는 요구가 없음
  - registry를 추가하면 build·검증·versioning 경계가 하나 더 생김
- **현재 제품 component 경계는 OpenStatus보다 더 엄격함**
  - `packages/ui`는 범용 primitive만 소유함
  - repository, commit, diff, documentation navigation 같은 제품 의미는 앱에 남김
  - 이 경계는 registry 도입 때문에 완화하지 않아야 함

## 채택할 내용

- **registry를 package의 대체물이 아닌 별도 코드 배포 수단으로 정의함**
  - 내부 공유는 계속 `@jongminchung/ui` package source를 사용함
  - 외부 복사 설치가 필요한 block만 registry 후보로 취급함
- **registry 항목은 유형과 의존성 graph를 명시하도록 설계함**
  - primitive, hook, lib, block을 구분함
  - 암묵적인 app alias나 private module에 의존하지 않도록 함
  - 필요한 semantic token과 외부 dependency를 항목 단위로 선언함
- **첫 pilot은 실제 외부 소비 요구가 생긴 한 개 block으로 제한함**
  - package primitive 전체를 registry로 재노출하지 않음
  - 제품 서버 상태나 private API에 의존하는 block을 배포하지 않음
  - install 결과를 별도 sample consumer에서 검증함

## 채택하지 않을 내용

- **현재 시점에는 `registry.json`, registry site와 registry build script를 추가하지 않음**
  - 소비자가 없는 배포 채널은 유지보수 표면만 증가시킴
- **OpenStatus의 package dependency 범위를 그대로 복제하지 않음**
  - 공용 package가 제품 요구에 필요한 모든 라이브러리를 소유하는 구조를 피함
- **앱의 제품 component를 registry를 이유로 `packages/ui`로 이동하지 않음**
  - code distribution과 runtime ownership은 별개의 결정임

## 실행 조건

- **다음 조건 중 하나가 발생하면 pilot을 시작함**
  - monorepo 밖의 프로젝트가 동일한 UI block source를 복사 설치해야 함
  - 두 개 이상의 독립 저장소가 같은 block의 수동 복사본을 유지하게 됨
  - 공개 예제나 template에서 install 가능한 block 제공이 제품 요구가 됨
  - package dependency로 제공하기 어려운 open-code customization 요구가 반복됨

## 완료 조건

- **조건 충족 후 별도 구현 PR에서 다음 항목을 증명함**
  - 한 개 block을 `shadcn add <registry-url>`로 clean consumer에 설치 가능함
  - 설치된 block이 private alias와 저장소 내부 path에 의존하지 않음
  - 필요한 CSS variable, registry dependency와 package dependency가 manifest에 포함됨
  - registry build 실패가 저장소 전체 check에서 식별됨
  - source 소유 위치와 배포 license가 명확함

## 검증

- **pilot이 시작되기 전까지 별도 검증 명령을 추가하지 않음**
- **pilot 구현 시 package와 앱 검증에 clean consumer 설치 테스트를 추가함**
  - `pnpm --filter @jongminchung/ui run typecheck`
  - `pnpm --filter @jongminchung/ui run test`
  - 영향받는 앱 build와 browser test
  - registry install 후 consumer typecheck와 production build

## 2026-08-20 처리 결과

- **저장소 전체 검색에서 외부 registry consumer와 복사 설치 요구가 확인되지 않아 보류 조건을 유지함**
  - 두 앱은 계속 `@jongminchung/ui`의 workspace source를 직접 소비함
  - `registry.json`, registry URL과 `shadcn add` 기반 외부 설치 흐름이 production source·workflow에 없음
- **실행 조건이 하나도 충족되지 않은 상태에서 pipeline을 추가하면 검증 대상이 없는 배포 채널만 늘어나므로 구현하지 않음**
  - 이 결론은 구현 누락이 아니라 이 문서에 정의된 조건부 보류 정책의 적용 결과임
- **향후 외부 저장소 consumer 또는 공개 install block 요구가 생기면 이 문서의 한 개 block pilot으로 다시 시작해야 함**
