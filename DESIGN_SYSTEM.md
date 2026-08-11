# 디자인 시스템

- 공용 primitive는 `@jongminchung/ui`에서 소스 코드로 직접 소유·수정
- 제품 UI의 조합과 동작은 각 앱에서 소유
- `@jongminchung/ui`는 별도로 배포하는 디자인 시스템이 아닌 내부 shadcn 소스 패키지

## 소유권

- `@jongminchung/ui`
  - shadcn primitive와 `cn`
  - 공용 Tailwind 진입점
  - 값이 없는 semantic token 계약
  - Tailwind 색상·radius 매핑
- 각 앱
  - `theme.css`의 실제 값
  - 제품 component와 layout
  - 상태와 플랫폼별 동작
- 공용 primitive는 파일 단위 named export만 제공
- default export 사용 금지
- 공용 primitive import는 명시적인 subpath 사용

```tsx
import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
```

- 금지 사항
  - 여러 모듈을 `index.ts`에서 묶어 다시 export하는 root barrel
  - `@jongminchung/ui` 패키지 root import
  - 앱 내부 `components/ui`에 공용 primitive 복사
  - 앱에서 `@base-ui/react` 직접 import

## 컴포넌트 추가

- 기준: [shadcn monorepo workflow](https://ui.shadcn.com/docs/monorepo)
- 실행 위치: component나 block을 사용할 앱 workspace

```bash
cd apps/<app>
pnpm exec shadcn add <component-or-block>
```

- CLI 라우팅
  - 공용 primitive와 registry hook: `packages/ui`
  - 앱 block과 제품 composition: 해당 앱
- 생성 파일은 commit 전 검토
- `packages/ui/components.json`의 `base-nova`, Base UI, Lucide, neutral, RSC 설정 유지
- 새 primitive와 hook은 기존 `./components/*`, `./hooks/*` wildcard export 사용
- 여러 모듈을 묶는 root `index.ts`와 root package export 추가 금지
- `packages/ui/src/components`의 모든 component를 registry 관리 공용 primitive로 취급
- 공용 component 설치·갱신은 사용하는 앱 workspace에서 shadcn CLI로만 수행
- CLI 실행 후 primitive가 `packages/ui`에 생성되고 앱 composition이 해당 앱에 남는지 확인
- 앱별 제품 component는 앱의 component 디렉터리에서 공용 primitive를 조합해 구현

## Package Imports

- 기준: [shadcn package imports](https://ui.shadcn.com/docs/package-imports)
- 앱 내부 registry 파일
  - 가장 가까운 `package.json#imports`의 `#components`, `#lib` 사용
- `packages/ui/components.json`
  - `#components`, `#hooks`, `#lib`를 private 설치 경로로 사용
- 앱에서 공용 패키지로 라우팅된 파일
  - `@jongminchung/ui/components/*`
  - `@jongminchung/ui/hooks/*`
  - `@jongminchung/ui/lib/*`
- registry hook은 `packages/ui`에서 소유
- 공용 primitive가 특정 앱의 private alias에 의존하는 구성 금지
- `tsconfig.base.json` 필수 설정
  - `moduleResolution: "bundler"`
  - `resolvePackageJsonImports: true`
- 로컬 `@/*` compiler path 추가 금지
- 생성된 registry import를 별도 alias 방식으로 임의 변경 금지
- Git Client의 빈 `paths` 객체는 root test alias가 `rootDir`을 넘지 않도록 차단하는 용도
- Git Client의 빈 `paths` 객체를 별도 import alias로 사용하지 않음

## Variant

- class 추가 전 공용 primitive가 제공하는 variant 우선 사용
- 공용 variant 추가 조건
  - 둘 이상의 앱에서 같은 semantic intent로 재사용
  - 제품 layout이나 제품 동작을 포함하지 않음
- 배치, 너비, 일회성 layout은 호출 위치에서 소유
- `Button`의 shadcn Base UI API
  - `variant`: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
  - `size`: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`
- 링크는 anchor 또는 Next `Link`에 `buttonVariants` 적용
- loading은 `Spinner`, native `disabled`, `aria-busy`로 조합
- `Button`에 `isLoading` 추가 금지
- 하나의 list row에 모든 interaction을 흉내 내는 구현 금지
- 목적에 맞는 `Item`, `CommandItem`, `RadioGroup`, `Checkbox`, `Select`, `Menu`, Button 또는 Link 사용

## 테마와 Tailwind

- 기준: [shadcn theming contract](https://ui.shadcn.com/docs/theming)
- `@jongminchung/ui/globals.css` 소유 범위
  - Tailwind, `shadcn/tailwind.css`, `tw-animate-css` import
  - 값이 없는 `tokens.css` 계약 import
  - 공용 UI source tree 등록
  - 기본 border, focus outline, body background·foreground layer
- 각 앱의 책임
  - `@jongminchung/ui/globals.css` import
  - 앱의 `theme.css` import
  - 앱 source tree를 `@source`로 등록
- token 계약은 `@jongminchung/ui/tokens.css`로도 export
- 동일한 계약을 위한 별도 theme package 추가 금지
- 모든 앱의 각 theme scope에서 다음 provider 값을 완전하게 정의
  - background·foreground
  - surface와 action
  - border·input·ring
  - chart와 sidebar
  - radius
- terminal 색상이나 status panel처럼 제품 의미가 있는 token은 해당 앱에서 소유
- 같은 의미와 consumer 계약을 둘 이상의 앱이 공유할 때만 공용 token으로 이동
- dark mode 선택자: `data-theme="dark"`
- 공용 `@custom-variant dark`도 같은 data attribute를 대상으로 유지
- token 추가 순서
  - 적용되는 모든 `:root` theme scope에 provider 추가
  - `packages/ui/src/styles/tokens.css`의 `@theme inline`에서 한 번만 노출
- UI 색상은 semantic variable과 `color-mix(in oklch, ...)` 사용
- radius는 공용 scale 사용
- 일반 UI 코드에서 palette utility와 hex·RGB·HSL literal 사용 금지
- CSS variable을 사용할 수 없는 renderer 경계는 정확한 test allowlist와 사유 기록 필수

## 런타임 경계

- Next 앱은 기본적으로 Server Component 사용
- `"use client"`가 있는 공용 component는 실제 server output에서 import될 때만 client boundary 생성
- 정적 shell, link, document content는 server rendering 유지
- provider는 필요한 가장 작은 interactive subtree에 배치
- `apps/engineering-docs`와 `apps/readme`는 `@jongminchung/ui`를 transpile
- Vite 기반 Git Client는 같은 소스 패키지를 사용하고 `react`, `react-dom`을 dedupe
- 모든 workspace는 동일한 최신 안정 TypeScript 6 compiler 사용
- compiler major 전환 조건
  - Compiler API 검증
  - framework build 검증
  - package tooling 검증
  - editor integration 검증
  - release graph 검증
- production에서 workspace별 compiler 분리 또는 dual compiler 구성 금지
- 제품 동작은 각 앱에서 소유
- Git Client의 dismissal policy, inline·fullscreen dialog layout, navigation, command 실행은 `Product*` component와 controller에서 관리

## 검증

- 계약 테스트 대상
  - `components.json` 라우팅
  - package export
  - token·radius·variant 계약
  - 앱 내부 primitive 복사 방지
  - 앱의 Base UI 직접 import 방지
- 동작 테스트 대상
  - native Button과 link semantic
  - Dialog dismiss와 focus
  - Field announcement
  - mixed Checkbox
  - Item role
  - Command keyboard navigation
- 시각 변경은 Playwright screenshot을 직접 검토
- 의도하지 않은 시각 변경을 숨기기 위한 snapshot 갱신 금지
