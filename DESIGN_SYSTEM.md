# 디자인 시스템

- `@jongminchung/ui`는 저장소 내부 앱을 위한 공용 primitive 기반으로 소스 코드에서 직접 소유·수정
- 제품 UI의 조합과 동작은 각 앱에서 소유
- `@jongminchung/ui`는 workspace에서 source-first로 개발하고 GitHub Packages에 고정 `1.0.0`으로 배포

## 소유권

- `@jongminchung/ui`
  - 저장소가 소유하는 UI primitive와 `cn`
  - 공용 Tailwind 진입점과 전역 CSS 계약
  - 값이 없는 semantic token 계약
  - 앱 override가 없는 경우의 neutral light·dark 기본 theme 값
  - Tailwind 색상·radius 매핑
- 각 앱
  - 앱 theme 값과 제품 token
  - 제품 component와 layout
  - 상태와 플랫폼별 동작
- 소유권은 사용 앱 수가 아니라 추상화 계층으로 결정
  - 한 앱만 사용하는 범용 primitive도 `@jongminchung/ui`에서 소유
  - 여러 앱에서 형태가 비슷한 제품 composition도 제품 의미와 동작이 다르면 각 앱에서 소유
- 앱별 제품 소유 범위
  - Git Client: Repository, Commit, Diff, Terminal UI와 제품 token
  - Engineering Docs: Navigation, SearchPalette, 문서 card와 문서 theme
  - README: landing page composition, 브랜드 표현과 marketing theme
- 공용 primitive는 파일 단위 named export만 제공
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
- [Open Code와 Composition](https://ui.shadcn.com/docs)의 공식 원칙
  - registry는 복사할 수 있는 공식 구현과 문서의 기준이며 런타임 UI 라이브러리가 아님
  - 생성된 source는 저장소가 소유하고 제품 요구에 맞게 직접 수정
  - upstream 갱신은 로컬 수정을 덮어쓰지 않고 diff를 검토해 필요한 변경만 병합
- UI 계층 기준
  - primitive: 접근성, 상태와 범용 API를 캡슐화하고 `packages/ui`에서 소유
  - variant: 제품과 무관한 semantic intent를 표현할 때 primitive API로 제공
  - composition: 공식 composition 구조를 지키면서 primitive를 조합하고 사용하는 앱에서 소유
  - 앱 overlay: 앱 theme 값, 제품 token, layout, 상태와 동작을 앱의 style과 component에서 적용
- 실행 위치: component나 block을 사용할 앱 workspace

```bash
cd apps/<app>
pnpm exec shadcn add <component-or-block>
```

- CLI 라우팅
  - 공용 primitive와 registry hook: `packages/ui`
  - 앱 block과 제품 composition: 해당 앱
- 생성 파일은 commit 전 검토
- shadcn은 루트 개발 CLI로만 사용하고 공용 UI의 배포 의존성으로 추가하지 않음
- `packages/ui/components.json`의 `base-nova`, Base UI, Lucide, neutral, RSC 설정 유지
- 새 primitive와 hook은 기존 `./components/*`, `./hooks/*` wildcard export 사용
- 여러 모듈을 묶는 root `index.ts`와 root package export 추가 금지
- `packages/ui/src/components`의 모든 component를 registry 관리 공용 primitive로 취급
- 공용 component 설치·갱신은 사용하는 앱 workspace에서 shadcn CLI로만 수행
- CLI 실행 후 primitive가 `packages/ui`에 생성되고 앱 composition이 해당 앱에 남는지 확인
- 앱별 제품 component는 앱의 component 디렉터리에서 공용 primitive를 조합해 구현
- 기존 primitive 갱신 절차
  - 사용하는 앱 workspace에서 `pnpm exec shadcn add <component> --diff` 실행
  - 공식 registry와 저장소 source 차이를 검토하고 접근성·API·style 변경 중 필요한 항목만 수동 병합
  - 로컬 variant와 앱 overlay를 확인하며 `--overwrite`로 일괄 교체하지 않음
  - 영향받는 UI package와 앱 검증 후 변경을 commit
- 임시 upstream 접근성 보정
  - `cmdk@1.1.1`의 초기 선택 `aria-activedescendant` 누락은 [upstream PR #411](https://github.com/dip/cmdk/pull/411)이 배포될 때까지 `CommandInput`에서만 보정
  - item ID와 키보드 선택은 `cmdk`에 맡기고 별도 ID 생성이나 keydown 동기화는 추가하지 않음

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
- 공개 package consumer는 ESM JavaScript와 declaration을 사용
- workspace tooling은 package export의 `source` 조건을 우선 사용
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
  - 사용 앱 수와 무관하게 제품에 종속되지 않은 semantic intent를 표현
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
  - Tailwind와 `tw-animate-css` import
  - 실제 사용하는 data-state variant와 `no-scrollbar` 정의
  - `theme.css`의 neutral light·dark 기본값 import
  - 값이 없는 `tokens.css` 계약 import
  - 공용 UI source tree 등록
  - 기본 border, focus outline, body background·foreground layer
- 각 앱의 책임
  - `@jongminchung/ui/globals.css` import
  - 공용 기본값을 바꿀 때 그 뒤에서 앱의 `theme.css` import
  - 앱 source tree를 `@source`로 등록
- 소비자는 앱의 전역 CSS에서 공용 진입점을 한 번만 import하고, 해당 CSS를 framework entry에서 기존 Tailwind 방식대로 로드

```css
@import "@jongminchung/ui/globals.css";
@import "./theme.css";

@source "../**/*.{ts,tsx}";
```

```tsx
import "./globals.css";
```

- `globals.css`가 Tailwind, animation, 상태 variant, 기본 theme, token mapping과 공용 UI source scanning을 제공
- 소비자는 `tailwindcss`, `tw-animate-css` 또는 공용 UI source를 중복 import·등록하지 않음
- 앱 `theme.css` import는 공용 기본 token을 덮어쓸 때만 추가
- 공용 기본값은 `@jongminchung/ui/theme.css`로도 export
- 공용 기본 selector는 `:where(:root)`와 `:where(:root[data-theme="dark"])`로 specificity를 낮춤
- 소비자 override는 `globals.css` 뒤에서 `:root` 또는 `:root[data-theme="dark"]`에 필요한 token만 선언
- token 계약은 `@jongminchung/ui/tokens.css`로도 export
- 동일한 계약을 위한 별도 theme package 추가 금지
- 공용 기본 theme의 light·dark scope에서 다음 provider 값을 완전하게 정의
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
- `apps/engineering-docs`와 `apps/readme`는 workspace의 `@jongminchung/ui` source를 transpile
- Vite 기반 Git Client는 `source` export condition으로 같은 소스를 사용하고 `react`, `react-dom`을 dedupe
- 외부 consumer는 공개 subpath의 ESM JavaScript와 declaration을 사용
- 호환성 판단은 저장소 내부의 실제 import와 consumer를 기준으로 수행
- GitHub Packages 배포는 고정 `1.0.0`을 대체하는 source-first 내부 배포 정책을 유지
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
  - package export와 tarball
  - 기본 theme·override cascade·token·radius·variant 계약
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
