# 프론트엔드 OSS 유지보수 권장안

- 기준일은 2026-08-19이며 현재 저장소의 `Tailwind CSS 4`, `shadcn/ui`, `Base UI`,
  `@jongminchung/ui`, Next.js Web 앱과 Electron Git Client를 범위로 함
- 세부 구현 계약은 [디자인 시스템](../DESIGN_SYSTEM.md), 일반 변경 절차는
  [유지보수 가이드](maintenance.md)를 단일 기준으로 사용함
- 이 문서는 특정 OSS 프로젝트의 코드를 그대로 모방하는 규칙이 아니라, 공식 계약과 현재
  저장소를 대조해 장기 변경 비용을 낮추기 위한 권장 운영 모델임

## 핵심 요약

- **유지보수성의 핵심은 도구 수가 아니라 소유권 경계임**으로 `Tailwind CSS`는 스타일 컴파일,
  `shadcn/ui`는 소스 유입, `Base UI`는 접근성 동작, `@jongminchung/ui`는 저장소 정책을 담당해야 함
- **현재 `packages/ui` 중심 구조는 권장 방향과 대체로 일치함**으로 공용 primitive, semantic token,
  Tailwind 진입점과 앱별 composition이 이미 분리되어 있음
- **`shadcn/ui` 생성물은 외부 라이브러리가 아니라 저장소가 소유하는 코드로 취급해야 함**으로
  신규 추가는 미리보기 후 반영하고 업데이트는 `--diff`를 검토해 필요한 변경만 병합해야 함
- **Tailwind utility는 semantic token과 정적으로 완결된 class를 통해 사용해야 함**으로 색상·상태·
  radius 계약은 공용화하되 제품 layout과 일회성 수치는 앱에 남겨야 함
- **다음 우선순위는 새 도구 도입보다 기존 계약의 자동 검증 확대임**으로 alias·source routing,
  직접 의존성 우회, primitive 복사, 키보드·focus·접근성 동작을 CI에서 증명할 필요가 있음
- **Storybook과 정식 SemVer 배포는 조건부 도입이 적절함**으로 외부 소비자나 다수 기여자의 탐색·
  검토 비용이 실제 병목이 되기 전에는 현재 Playwright·Vitest 체계를 우선 활용해야 함

## 유지보수성은 변경 비용과 복구 가능성으로 판단함

- **시니어 OSS 유지보수의 목표는 변경을 막는 것이 아니라 변경의 영향 범위를 예측 가능하게 만드는 것임**
  - 새 기능이 어느 계층에 들어가야 하는지 한 번에 결정할 수 있어야 함
  - upstream 변경과 저장소 고유 변경을 diff에서 분리할 수 있어야 함
  - typecheck·동작·접근성·시각 회귀 중 어떤 검증이 필요한지 변경 종류로 결정할 수 있어야 함
  - 문제가 생기면 관련 package 또는 앱만 되돌릴 수 있어야 함
- **좋은 추상화는 코드 중복보다 변경 이유를 기준으로 형성됨**
  - 여러 앱이 사용하는 범용 button은 공용 primitive가 적합함
  - 여러 앱에서 비슷해 보이더라도 제품 의미와 상태 전이가 다른 toolbar는 앱 소유가 적합함
  - 한 앱만 사용하더라도 접근성·상태 API가 범용적인 primitive는 공용 계층이 적합함
- **유지보수 위험은 경계가 섞일 때 증가함**
  - 앱이 `@base-ui/react`를 직접 사용하면 공용 접근성 보정과 API 정책을 우회하게 됨
  - 공용 package가 제품 token과 화면 layout을 가지면 다른 앱의 변경까지 결합됨
  - Tailwind class를 런타임 문자열 조합으로 생성하면 source detection과 회귀 검증이 어려워짐
  - 생성 도구의 overwrite를 허용하면 upstream 변경과 로컬 의도를 구분하기 어려워짐

## 각 도구는 하나의 책임만 가져야 함

| 계층        | 도구·위치                     | 소유하는 책임                                                   | 소유하지 않는 책임                               |
| ----------- | ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| 스타일 엔진 | `Tailwind CSS`                | utility 생성, theme variable 매핑, variant와 source detection   | 제품 component API, 접근성 동작, 디자인 의사결정 |
| 소스 유입   | `shadcn` CLI와 registry       | component 초안, dependency·alias routing, upstream diff         | 런타임 UI 소유권, 자동 overwrite, 제품 요구사항  |
| 동작 기반   | `Base UI`                     | headless interaction, keyboard, focus, ARIA 기반 primitive      | 시각 theme, 제품 문구, 앱 상태                   |
| 저장소 정책 | `packages/ui`                 | 공용 primitive API, semantic token, 기본 theme, Tailwind 진입점 | 제품 layout, 도메인 상태, 앱별 workflow          |
| 제품 구현   | `apps/web`, `apps/git-client` | composition, 제품 token, 화면 layout, 상태와 사용자 흐름        | 공용 primitive 복사, 공용 동작 기반의 직접 우회  |

- **이 분리는 공식 도구의 의도와도 일치함**
  - `shadcn/ui`는 실제 component source를 전달하는 Open Code 모델이며 사용자가 코드를 소유한다고
    설명함
  - `Base UI`는 CSS를 강제하지 않는 headless·accessible·composable 기반이라고 설명함
  - `Tailwind CSS`는 theme variable을 utility API로 노출하는 디자인 토큰 계층으로 설명함
  - 근거는 [shadcn/ui 소개](https://ui.shadcn.com/docs),
    [Base UI 개요](https://base-ui.com/react/overview/about),
    [Tailwind CSS theme variable](https://tailwindcss.com/docs/theme)임
- **현재 저장소에서는 `@jongminchung/ui`가 세 외부 도구를 흡수하는 anti-corruption layer 역할을 함**
  - 앱은 외부 primitive의 세부 API보다 저장소가 합의한 subpath와 semantic token에 의존함
  - 외부 도구 교체 시 앱 전체가 아니라 `packages/ui`와 계약 테스트를 중심으로 변경할 수 있음

## Tailwind는 semantic token과 정적 class 계약으로 운영함

- **테마는 값·의미·사용처를 분리하는 3단계 계약이 적합함**
  - provider 값은 `theme.css`의 `:root`와 dark scope에서 실제 색상·radius·shadow를 정의함
  - adapter는 `tokens.css`의 `@theme inline`에서 provider를 `bg-background` 같은 utility로 노출함
  - consumer는 공용 utility를 사용하고 제품 전용 token만 앱 theme에 추가함
  - 이 구조는 CSS variable을 semantic token으로 권장하는
    [shadcn/ui 테마 계약](https://ui.shadcn.com/docs/theming)과 일치함
- **공용 token은 시각값이 아니라 안정된 의미를 표현해야 함**
  - `background`, `foreground`, `primary`, `destructive`, `ring`처럼 여러 primitive가 공유하는 역할은
    공용 계약으로 유지함
  - terminal ANSI 색상, repository 상태, marketing gradient처럼 제품 의미가 있는 값은 앱에서 소유함
  - 새 token은 light·dark provider, Tailwind adapter, 실제 consumer와 계약 테스트를 같은 변경에서 추가함
- **Tailwind class는 source에서 완전한 문자열로 보여야 함**
  - 상태별 class는 문자열 일부를 조합하지 않고 완결된 class map 또는 `cva` variant로 정의함
  - `bg-${color}-500`과 같은 동적 생성은 사용하지 않음
  - Tailwind는 source를 코드로 해석하지 않고 문자열 token으로 탐색하므로 정적 class가 필요하다는
    [공식 source detection 설명](https://tailwindcss.com/docs/detecting-classes-in-source-files)을 따름
- **모노레포 source scanning은 암묵적 탐색보다 명시적 등록을 우선함**
  - 공용 진입점은 `packages/ui` source를 한 번 등록함
  - 각 앱은 자신의 source tree를 `@source`로 등록함
  - build output, audit evidence와 생성물은 `@source not`으로 제외함
  - build 실행 위치가 달라질 수 있는 workspace는 source 기준 경로가 유지되는지 계약 테스트로 확인함
- **arbitrary value는 금지가 아니라 사용 범위를 제한함**
  - 허용 범위는 한 화면의 grid track, 계산식, 외부 renderer 치수처럼 재사용 의미가 없는 layout 값임
  - semantic 색상, focus, 상태, radius와 반복되는 z-index는 token 또는 공용 variant로 승격함
  - 긴 class 문자열은 길이만으로 component화하지 않고 동일한 의미·상태·변경 이유가 반복될 때 추출함
  - 복잡한 descendant selector가 제품 구조를 설명한다면 앱 component 또는 CSS Module로 이동할 수 있음
- **`@apply`와 CSS Module은 제한적으로 사용함**
  - 공용 base layer처럼 utility 의미를 재사용하는 작은 범위에는 사용할 수 있음
  - Tailwind v4에서 별도 처리되는 stylesheet가 theme·utility 정의를 참조해야 하면 `@reference`가
    필요하다는 [공식 upgrade guide](https://tailwindcss.com/docs/upgrade-guide)를 따름
  - 단순 CSS variable 사용으로 충분하면 빌드 결합을 줄이기 위해 직접 `var(...)`를 우선할 수 있음

## shadcn과 Base UI는 검토 가능한 upstream으로 관리함

- **`shadcn/ui` component는 설치 이후 저장소 소유 코드임**
  - registry는 시작점과 비교 기준이며 runtime dependency의 숨겨진 구현이 아님
  - 로컬 접근성 보정, variant와 API 결정은 일반 source와 동일하게 review·test·commit함
  - upstream 최신 코드와 일치하는 것보다 저장소의 공개 계약과 소비 앱을 깨뜨리지 않는 것이 우선임
- **신규 component는 앱 workspace에서 dry run 후 추가함**

  ```sh
  pnpm --filter <app-package> exec shadcn add <component> --dry-run
  pnpm --filter <app-package> exec shadcn add <component>
  ```

  - CLI가 primitive를 `packages/ui`로, 제품 block을 앱으로 라우팅하는지 확인함
  - dependency, alias, `components.json`, generated source와 app import를 각각 검토함
  - 모든 workspace가 같은 `style`, `iconLibrary`, `baseColor`를 유지하고 Tailwind v4의 config 경로를 비워
    두어야 한다는 [공식 monorepo 계약](https://ui.shadcn.com/docs/monorepo)을 따름

- **기존 component는 overwrite가 아니라 diff 병합으로 갱신함**

  ```sh
  pnpm --filter <app-package> exec shadcn add <component> --diff
  ```

  - upstream의 접근성·동작·style 변경을 구분함
  - 현재 소비처와 공개 prop·variant에 미치는 영향을 확인함
  - 필요한 변경만 수동 병합하고 로컬 보정의 제거 조건을 함께 검토함
  - `--overwrite`는 파일을 의도적으로 원상 복구하는 별도 변경에서만 허용함
  - `--dry-run`, `--diff`, `--view`의 검토 목적은
    [shadcn CLI 문서](https://ui.shadcn.com/docs/cli)에 명시되어 있음

- **Base UI는 접근성의 전부가 아니라 동작 기반임**
  - keyboard, focus와 ARIA의 기본 동작은 upstream primitive를 활용함
  - visible focus, color contrast, accessible name, 제품 문구와 실제 조합 검증은 저장소가 책임짐
  - 이러한 책임 분리는 [Base UI 접근성 가이드](https://base-ui.com/react/overview/accessibility)에 명시되어 있음
- **임시 upstream 보정은 종료 조건을 가져야 함**
  - 관련 package version, upstream issue 또는 PR, 로컬 보정 위치와 삭제 조건을 기록함
  - dependency 갱신 때 해당 보정이 여전히 필요한지 확인함
  - upstream API를 앱에서 직접 우회하는 방식보다 공용 primitive의 최소 범위에서 보정함

## 공용 API는 최소화하고 제품 조합은 앱에 남김

- **공용 package는 explicit subpath만 공개함**
  - `@jongminchung/ui/components/button`처럼 파일 단위 named export를 사용함
  - root barrel은 의존 관계, tree shaking, 변경 범위와 순환 참조를 불투명하게 하므로 추가하지 않음
  - React·Tailwind처럼 소비 앱과 단일 instance 또는 compiler 계약을 공유하는 항목은 peer 범위를 유지함
- **공용화 판단은 소비 앱 수보다 추상화 수준을 우선함**

| 변경 사례                             | 권장 소유 위치          | 판단 근거                            |
| ------------------------------------- | ----------------------- | ------------------------------------ |
| keyboard·focus를 포함한 범용 `Select` | `packages/ui`           | 제품과 무관한 primitive 동작임       |
| Git branch 선택 panel                 | `apps/git-client`       | Git 도메인 상태와 문구를 포함함      |
| 문서 검색 dialog                      | `apps/web`              | 검색 index와 route 동작을 포함함     |
| 공통 `primary`·`ring` 역할            | `packages/ui` token     | 여러 primitive의 안정된 의미임       |
| terminal ANSI·repository 상태 색상    | `apps/git-client` theme | 제품 renderer와 도메인 의미에 종속됨 |
| 한 화면의 grid 계산식                 | 호출 위치               | 재사용 계약이 없는 layout 값임       |

- **variant는 제품 이름이 아니라 semantic intent를 표현함**
  - `destructive`, `outline`, `ghost`처럼 어느 앱에서도 같은 의미를 갖는 상태만 primitive API에 포함함
  - `commit`, `repository`, `marketing`처럼 제품 맥락을 나타내는 variant는 앱 composition으로 구현함
  - 단순 위치·너비·margin은 호출 위치가 소유하며 primitive prop으로 확대하지 않음
- **wrapper는 정책을 추가할 때만 만듦**
  - 접근성 label 강제, 공통 dismissal 정책, 제품 상태 연결처럼 명확한 책임이 있을 때 wrapper를 사용함
  - class 이름을 짧게 만들거나 prop을 그대로 전달하기 위한 wrapper는 새 API 계층만 증가시킴
- **외부 소비자가 생기면 현재 배포 계약을 전환해야 함**
  - 현재 고정 `1.0.0` 교체 방식은 저장소 내부 source-first 소비에는 사용할 수 있음
  - 제3자가 package를 설치하는 시점에는 같은 version의 API·integrity가 달라지는 정책을 중단하고
    SemVer, changelog, migration note와 immutable release를 도입해야 함
  - 이는 현재 오류라기보다 소비자 범위가 바뀔 때 반드시 충족해야 하는 전환 조건임

## 검증과 업데이트를 변경 유형별로 계층화함

- **1단계 정적 계약은 잘못된 소유권과 routing을 가장 저렴하게 차단함**
  - 모든 앱과 `packages/ui`의 `components.json` style·icon·base color 일치 여부를 검사함
  - primitive가 `packages/ui`로 생성되고 앱에 `components/ui` 복사본이 없는지 검사함
  - 앱의 `@base-ui/react` 직접 import와 `@jongminchung/ui` root import를 금지함
  - Tailwind 진입점 중복 import, source path와 package export를 검사함
  - semantic color를 우회하는 palette·literal은 정확한 renderer allowlist 밖에서 차단함
- **2단계 primitive 계약은 component API와 server markup을 검증함**
  - native element, disabled, busy, label, role, mixed state와 공개 variant를 검증함
  - type-level 필수 prop과 package declaration·ESM subpath를 검증함
  - 현재 `packages/ui/src/components.test.ts`의 방향을 유지하되 SSR markup만으로 증명할 수 없는 동작은
    다음 단계로 분리함
- **3단계 browser interaction은 복합 primitive의 실제 동작을 검증함**
  - Dialog·Select·Command·Menu·Tabs의 keyboard navigation, focus 진입·복원과 Escape 동작을 검증함
  - light·dark, reduced motion, pointer와 keyboard 입력을 중요한 조합에 포함함
  - `axe` 자동 검사는 보조 gate로 사용하고 accessible name과 읽기 순서는 role 기반 assertion으로 검증함
- **4단계 앱 E2E와 시각 회귀는 제품 composition을 검증함**
  - Web과 Git Client의 핵심 사용자 흐름에서 공용 primitive와 앱 상태의 결합을 확인함
  - screenshot은 안정된 viewport·font·OS 조건에서만 기준선으로 사용함
  - 변경된 snapshot은 자동 승인하지 않고 의도한 token·layout 변경인지 직접 검토함
- **5단계 package 검증은 외부 경계를 증명함**
  - dry-run tarball의 source, ESM JavaScript, declaration, CSS와 export map을 확인함
  - 실제 consumer build를 통해 Next.js와 Vite 양쪽 호환성을 확인함
  - 의존성 major 변경은 package test만이 아니라 두 consumer build와 주요 E2E까지 검증함
- **Storybook은 즉시 필수 도구가 아니라 탐색·협업 문제에 대한 선택지임**
  - component 상태를 찾기 어렵거나 PR에서 isolated review가 반복적으로 필요할 때 도입함
  - 세 개 이상의 독립 consumer, 외부 기여자 증가, 시각 QA 병목 중 하나가 지속될 때 재평가함
  - 도입 시 story를 별도 예제가 아니라 browser component·accessibility·visual test fixture로 재사용함
  - Storybook이 story를 여러 UI 상태의 test case로 활용한다는
    [공식 testing 문서](https://storybook.js.org/docs/writing-tests)를 근거로 함

- **runtime dependency 갱신은 lockfile과 동작 호환성 변경임**
  - `Tailwind CSS`, `Base UI`, React와 framework release note를 검토함
  - minor·patch도 focus, portal, selector, generated CSS가 바뀔 수 있으므로 관련 browser test를 실행함
  - major는 별도 PR로 분리하고 migration 범위와 rollback 조건을 기록함
- **shadcn registry 갱신은 소스 코드 변경임**
  - 일반 dependency bot이 자동 병합할 대상으로 보지 않음
  - component별 `--diff`를 검토하고 로컬 API·style·접근성 보정과 함께 병합함
  - 한 PR에서 무관한 component 전체를 최신화하지 않음
- **theme·token 갱신은 디자인 계약 변경임**
  - 색상값 하나가 여러 앱에 전파되므로 affected surface와 light·dark screenshot을 명시함
  - token rename은 검색 가능한 migration과 consumer 동시 변경으로 처리함
  - 값 변경과 구조 변경을 가능하면 분리해 review에서 의도를 드러냄
- **PR은 변경 종류에 맞는 증거만 요구함**

| 변경 종류             | 최소 검증                             | 추가 검증 조건                             |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| 문서·주석             | format, link와 명령 확인              | 계약을 바꾸면 관련 test 추가               |
| primitive style       | UI typecheck·test, consumer 영향 확인 | 시각 변화가 있으면 screenshot              |
| primitive behavior    | UI test, browser interaction          | 앱 흐름 영향이 있으면 E2E                  |
| token·global CSS      | theme contract, 두 앱 build           | light·dark screenshot                      |
| Base UI·Tailwind 갱신 | package test, 두 앱 build             | focus·generated CSS 변화 시 E2E            |
| package export        | build, dry-run tarball                | 외부 소비자가 있으면 compatibility fixture |

## 현재 저장소는 자동화 공백부터 보완함

- **유지할 강점은 이미 명확함**
  - `packages/ui`가 primitive, theme, token adapter와 Tailwind 진입점을 함께 소유함
  - 세 workspace의 `components.json`이 `base-nova`, Lucide, neutral과 Tailwind v4 구성을 맞춤
  - 앱이 공용 component를 explicit subpath로 import하고 Base UI 직접 사용을 공용 package로 제한함
  - Web theme contract, UI server markup test, Git Client Playwright·axe·snapshot 검증이 이미 존재함
  - catalog, peer dependency와 source-first export가 모노레포의 version·개발 경계를 명시함
- **1순위는 문서에만 있는 경계 규칙을 정적 계약으로 옮기는 것임**
  - `components.json` routing과 설정 일치 검사를 추가함
  - 앱의 Base UI 직접 import, 공용 primitive 복사와 package root import 방지 검사를 추가함
  - CSS entry·`@source`·package export 계약을 하나의 빠른 UI architecture test로 검증함
  - 이 검사는 새 lint 도구보다 기존 Vitest와 filesystem assertion으로 먼저 구현하는 것이 적절함
- **2순위는 복합 primitive의 browser interaction 증거를 보강하는 것임**
  - SSR test가 증명하지 못하는 Dialog focus 복원, Select keyboard 탐색, Menu dismissal을 우선함
  - 이미 존재하는 앱 Playwright fixture를 활용해 별도 component explorer 도입 없이 시작함
  - 앱 E2E와 중복되지 않도록 primitive 동작과 제품 workflow의 책임을 구분함
- **3순위는 style 예외를 명시적으로 관리하는 것임**
  - arbitrary layout 값의 개수를 목표로 줄이기보다 반복되는 semantic 값과 z-index 계층을 식별함
  - renderer 경계의 literal과 제품 전용 CSS variable은 allowlist와 사유를 test에 기록함
  - 긴 utility selector가 반복되는 제품 surface는 앱 component 또는 CSS Module 추출을 검토함
- **조건부 과제는 실제 소비자와 기여자 변화 뒤에 실행함**
  - 외부 package consumer가 생기면 immutable SemVer release와 changelog를 도입함
  - isolated component 탐색과 review가 병목이 되면 Storybook을 test fixture로 도입함
  - 여러 브랜드가 동일 token schema를 공유하게 되면 theme package 분리를 검토함
  - 조건이 충족되지 않으면 새 package와 build pipeline을 추가하지 않음

- **현재 아키텍처는 교체보다 강화가 적절함**으로 `Tailwind CSS → semantic token`,
  `shadcn/ui → reviewed source`, `Base UI → accessible behavior`, `@jongminchung/ui → repository policy`,
  `apps → product composition`의 경계를 유지함
- **다음 구현 PR은 빠른 UI architecture contract test 하나로 시작하는 것이 적절함**
  - `components.json`, import boundary, primitive duplication, CSS entry와 export map을 함께 검사함
  - 이후 Dialog·Select·Menu의 browser interaction test를 작은 PR로 분리함
- **새 도구 도입은 조건이 발생한 뒤 결정함**으로 현재는 Storybook·별도 token package·추가 wrapper보다
  기존 Vitest·Playwright·package contract의 빈틈을 메우는 편이 변경 비용과 운영 복잡도를 더 낮춤
- **이 문서의 권장안이 실제 규칙으로 확정되면** [디자인 시스템](../DESIGN_SYSTEM.md)의 검증 목록과
  CI 구현을 같은 변경에서 맞추고, 외부 소비자 발생 시 배포 정책을 별도 ADR로 기록할 필요가 있음
