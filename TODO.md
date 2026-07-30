# React / Next.js / Tailwind CSS / shadcn 개선 TODO

## 총평

- 전체 방향은 시니어 수준에 가깝다.
  - 공유 primitive와 앱별 제품 UI 소유권, Server Component 우선, 의미 토큰, OKLCH, 접근성·비주얼 테스트가 좋다.
  - Electron 앱에 Next.js를 억지로 도입하지 않은 선택도 맞다.
- 현재 상태를 “운영 가능한 시니어 품질”이라고 보기는 어렵다.
  - 문서에 노출된 두 경로가 실제 404다.
  - 표준 build/test gate가 여러 계약 드리프트로 실패한다.
  - `git-client`의 React 경계와 초기 번들이 이미 단일 파일/훅이 감당할 규모를 넘었다.

| 영역           | 평가               | 핵심 피드백                                                                                                               |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| React          | 부분 양호          | 타입·외부 값 검증·lazy loading은 좋지만 mega component/hook, Effect 실패 처리, 복합 위젯 접근성을 개선해야 한다.          |
| Next.js        | 양호하나 결함 있음 | App Router/RSC/Metadata/`next/font` 사용은 좋다. 콘텐츠 registry는 즉시 고치고 서버 HTML의 locale 계약도 보완해야 한다.   |
| Tailwind CSS   | 기반 매우 양호     | v4 CSS-first 구성과 의미 토큰은 좋다. 미사용 registry가 CSS 후보를 늘리고 반복 recipe가 source/JS 크기·locality를 해친다. |
| shadcn/Base UI | 모노레포 전환 완료 | `@jongminchung/ui`가 primitive를 소유하고 앱은 테마와 제품 동작을 소유한다.                                               |

## 유지할 것

- [x] `packages/ui`는 shadcn primitive, `cn`, 공통 Tailwind 진입점만 소유한다.
  - 앱은 `theme.css`, 제품 컴포넌트, 플랫폼 동작과 시각 언어를 계속 소유한다.
- [ ] `packages/theme-contract/src/tokens.css`는 값 없는 CSS-only 의미 토큰 계약으로 유지한다.
- [ ] 앱별 `theme.css`에서 완전한 OKLCH provider 값을 정의한다.
- [ ] Tailwind를 모든 레이아웃에 강제하지 않고 CSS Module과 역할을 나눈다.
- [ ] Next 앱은 Server Component를 기본으로 하고 상호작용만 Client Component로 격리한다.
- [ ] `Excalidraw`, CodeMirror, xterm 등 무거운 기능은 필요 시점에 적재한다.
- [ ] `unknown` 입력 검증, readonly 모델, Axe·키보드·CLS·비주얼 회귀 검증을 유지한다.
- [ ] 앱 E2E는 명시적 로컬/릴리스 검증 명령으로 유지한다.

## P0 — 배포·검증 신뢰성 복구

### [ ] Engineering Docs 콘텐츠의 진실 원천을 하나로 만든다

- 근거
  - `generated/content-manifest.json`에는 `en/ko/handbook/app-icons`가 있다.
  - `lib/documents.ts`의 수동 `docLoaders`에는 두 항목이 없다.
  - 실제 `/en/handbook/app-icons`, `/ko/handbook/app-icons` 응답은 404다.
- 이번 작업에서 해결
  - 중복 `content/ko/handbook/ddd copy.mdx`를 삭제했다.
  - TypeScript 7 호환성 문서는 source, loader, manifest, locale별 검색 index를 함께 등록했다.
  - content check, Engineering Docs Vitest 17건, production build와 Playwright 24건이 통과한다.
- 변경
  - `build-content.ts`가 정적 import를 가진 loader registry까지 생성하게 한다.
  - 문서 개수 매직 넘버 대신 `source ↔ manifest ↔ loader ↔ search index`의 완전한 일대일 대응을 검사한다.
- 완료 조건
  - manifest의 모든 URL이 200, 미등록 URL은 404다.
  - content check, Vitest, `next build`가 모두 통과한다.

### [ ] 깨진 workspace gate를 현재 구조와 동기화한다

- 근거
  - `packages/icon/src/targets.ts:3,38-49`에 삭제된 `immersive-translate`가 남고 `git-client` target은 없다.
  - tooling/remark package-contract는 `tsdown ^0.22.7`을 기대하지만 manifest는 `^0.22.12`다.
  - `apps/git-client/scripts/workflow-config.test.ts`는 삭제된 GitHub workflow 두 개를 계속 읽는다.
- 이번 작업에서 해결
  - UI 디렉터리가 없는 앱을 정상 상태로 처리하고 공유 package export/alias 계약으로 교체했다.
  - 기존 Base UI 직접 사용과 app-local primitive 복제를 검사하던 계약을 공유 shadcn 소유권 기준으로 갱신했다.
  - root format/lint/typecheck와 이번 전환 관련 계약·행동·E2E 테스트는 통과한다.
- 변경
  - 삭제 앱의 icon target을 제거하고 `git-client` target 또는 명시적 exemption을 등록한다.
  - 삭제 immersive-translate 관련해서 남아 있는 것에 대해서 삭제한다.
  - 도구의 정확한 patch 문자열보다 호환 범위·실제 build/pack 성공을 검증한다.
  - workflow 전용 assertion을 제거한다.
  - 함께 있던 `.node-version`/`engines` 검증은 로컬 runtime 계약 테스트로 분리한다.
- 완료 조건
  - `pnpm run icon:check`, root Vitest, 앱별 test/build가 모두 통과한다.

## P1 — React·Next·shadcn 경계 개선

### [ ] `git-client`의 App/session 경계를 제품 기능별로 분리한다

- 근거
  - `src/App.tsx`는 7,628줄이고 `RepositoryWorkspace`만 약 5,254줄이다.
  - `src/hooks/useGitSession.ts`는 2,292줄이며 90개 안팎의 값·명령을 한 객체로 반환한다.
  - 넓은 session 객체와 파생 배열은 변경 영향·렌더 범위·테스트 범위를 키운다.
- 변경
  - repository/session I/O, persistence, dialog, search/inspection controller를 독립 hook/service로 추출한다.
  - 상태 소유권을 나누고 leaf consumer는 equality가 있는 selector 또는 좁은 readonly slice만 받게 한다.
  - 좁은 TypeScript interface만으로는 re-render가 줄지 않으므로 React Profiler 기준을 함께 둔다.
  - 반환 타입과 상태 전이를 명시하고 기능별 행동 테스트를 먼저 고정한다.
  - 한 번에 재작성하지 않고 tracer-bullet 단위로 이동한다.
- 완료 조건
  - composition root 외의 기능/leaf component가 전체 session facade에 의존하지 않는다.
  - 기능별 상태 전이와 실패 경로를 독립 테스트할 수 있다.
  - 대표 작업의 commit 횟수·render 시간이 기준선보다 악화되지 않는다.

### [ ] Effect 기반 설정 저장을 실패 안전하게 만든다

- 근거
  - `App.tsx:6388-6518`은 read 오류를 삼킨 뒤 `loaded=true`로 바꾼다.
  - 이어지는 Effect가 메모리의 기본값을 저장해 기존 설정을 덮어쓸 수 있다.
  - write Promise 실패도 사용자 상태나 오류 경계에 연결되지 않는다.
- 변경
  - 공통 persistence adapter에 `loading | ready | error` 상태를 둔다.
  - read 성공 후에만 자동 저장한다.
  - unmount/동시 요청 취소와 read/write 오류 표시·재시도를 정의한다.
- 완료 조건
  - read 실패 시 write가 호출되지 않는다.
  - read/write/재시도/unmount/연속 상태 변경 경쟁 테스트가 통과한다.

### [x] Button 직접사용 예외 정책을 공유 primitive 정책으로 교체한다

- 근거
  - `DESIGN_SYSTEM.md:51-56`은 모든 호출부가 Base UI Button과 완전한 class recipe를 직접 소유하도록 강제한다.
  - 계약 테스트가 직접 import·slot·call-site recipe 정책을 강제한다.
  - 그 결과 현재 `apps/` 전체에 직접 import 68개 파일, `data-slot="button"` 326곳이 있다.
  - Git Client에서 동일한 기본 class 조합이 200회 이상 반복된다.
  - 현재 정책에는 호출부 명시성과 과도한 범용 wrapper 방지라는 장점도 있다.
- 완료
  - `@jongminchung/ui/components/button`에 공식 Base UI + CVA Button을 설치했다.
  - 호출부는 의미 `variant`/`size`와 배치 `className`만 지정한다.
  - 링크는 `buttonVariants`, loading은 `Spinner` + `disabled` + `aria-busy`를 사용한다.
  - 결정과 확장 기준을 ADR 및 `DESIGN_SYSTEM.md`에 반영했다.

### [x] 검색 palette를 실제 combobox 계약으로 구현한다

- 근거
  - `SearchPalette.tsx:211-259`의 input에는 `aria-controls`/`aria-activedescendant`가 없다.
  - 결과는 `role="list"` 아래 link로 렌더되어 선택 상태가 보조 기술에 전달되지 않는다.
  - 열린 검색 dialog는 현재 Axe 시나리오에 포함되지 않는다.
- 완료
  - Engineering Docs 검색과 Git Client 명령 팔레트를 공유 `Command`로 전환했다.
  - 수동 active-index 로직을 제거하고 input 중심의 `aria-activedescendant` 전략으로 통일했다.
  - 외부 검색 결과는 `shouldFilter={false}`로 전달하고 기존 navigation/command 실행을 유지한다.

### [x] 검색 index 적재를 lazy·취소 가능·실패 명시 상태로 바꾼다

- 근거
  - `SearchPalette.tsx:157-164`는 모든 문서 mount 때 35~40KB index를 즉시 fetch한다.
  - `AbortController`와 `catch`가 없어 locale race와 unhandled rejection이 가능하다.
- 완료
  - 최초 open 시 locale별 캐시를 적재하고 `AbortController`로 경쟁 요청을 취소한다.
  - `idle | loading | ready | error` union과 retry UI를 추가했다.

### [x] form/list 복합 위젯의 접근성 primitive를 좁힌다

- 근거
  - `git-client/src/components/ui/collections.tsx:22-77`의 `ListItem`은 `div` 하나가 static item, button, option 역할을 모두 허용한다.
  - 일부 listbox는 roving focus와 개별 button focus 전략을 섞는다.
  - `form-controls.tsx:55-60`의 오류 메시지는 control과 ID로 연결되지 않고 `aria-invalid`도 없다.
- 완료
  - `Item`, `CommandItem`, Radio/Checkbox/Select, Button/Link의 역할을 분리했다.
  - 앱 form wrapper를 공유 `Field` 계열로 재구성하고 description/error ID를 control에 연결했다.
  - `aria-describedby`, `aria-invalid`, mixed checkbox 상태를 지원한다.

## P2 — 일관성·유지보수성 정리

### [ ] locale을 서버의 `<html lang>`에 반영한다

- 근거
  - `engineering-docs/app/layout.tsx:38-42`는 항상 `lang="en"`이다.
  - `[locale]/layout.tsx`가 서버 HTML의 하위 `div`에 올바른 lang을 주지만, 문서 root는 hydration 전까지 `en`이다.
  - `DocsShell.tsx:87-91`이 hydration 후 root DOM을 보정한다.
- 변경
  - locale segment가 root layout의 `<html lang>`을 서버 렌더링하도록 route/layout을 재구성한다.
  - nested `div lang`은 fallback 필요성을 확인한 뒤 hydration 보정과 함께 정리한다.
- 완료 조건
  - raw response HTML에서 `/ko/**`는 `<html lang="ko">`, `/en/**`는 `<html lang="en">`이다.

### [ ] Git Client 초기 renderer bundle을 측정하고 기능 단위로 분리한다

- 근거
  - 현재 main JS는 약 1.36MB raw/325KB gzip, CSS는 약 199KB raw/33KB gzip이다.
  - `App.tsx:14-92`에서 드물게 여는 dialog·tool window를 대량 정적 import한다.
  - Vite가 500KB 초과 chunk 경고를 출력하지만 실제 cold-start 회귀는 아직 측정하지 않았다.
- 변경
  - Electron cold-start와 첫 상호작용 기준선을 먼저 측정한다.
  - 설정·진단·관리 dialog/tool window를 `lazy` + `Suspense`로 분리한다.
  - 초기 entry JS/CSS 및 cold-start 회귀 예산을 로컬 release check에 둔다.
- 완료 조건
  - warning threshold가 아니라 측정된 entry 크기와 cold-start 예산을 만족한다.
  - keyboard/focus/smoke 테스트가 유지된다.

### [ ] Git Client의 전역 Tailwind 문자열 registry를 점진적으로 해체한다

- 근거
  - `src/styles/tailwind.ts`는 643줄/약 131KB다.
  - 정적 참조 기준 미사용 key가 59개이며 문자열 literal은 사용 여부와 무관하게 Tailwind 후보가 된다.
  - 중복 속성, `!important`, legacy marker와 임의 속성이 한 registry에 섞여 있다.
- 변경
  - 재사용 UI variant는 앱 로컬 shadcn/CVA component로 이동한다.
  - 제품 레이아웃은 component-local Tailwind 또는 소유권이 명확한 `src/styles` CSS로 이동한다.
  - CSS Module을 선택한다면 이를 금지하는 앱 계약 테스트부터 명시적으로 변경한다.
  - 동적 marker만 작은 allowlist로 남기고 미사용 key를 제거한다.
- 완료 조건
  - style 변경의 영향 범위가 component 단위다.
  - 생성 CSS 크기와 unused key 수에 회귀 기준이 있다.

### [x] Engineering Docs의 생성되지 않는 animation utility를 정리한다

- 근거
  - dialog/tooltip이 `animate-in`, `fade-in`, `zoom-in`, `slide-in-*`을 사용한다.
  - 앱에는 `tw-animate-css` import/dependency가 없어 해당 CSS가 생성되지 않는다.
- 완료
  - 공유 Tailwind 진입점이 `tw-animate-css`를 명시적으로 import한다.
  - Engineering Docs가 공유 진입점을 사용해 shadcn animation utility를 생성한다.

### [x] 불필요한 Client Component 경계를 줄인다

- 근거
  - `EditPageLink.tsx`는 정적 anchor뿐인데 `"use client"`다.
  - `DocumentOutline.tsx`는 scroll button 하나 때문에 outline 전체가 client다.
- 완료
  - `EditPageLink`와 정적 `DocumentOutline`을 Server Component로 복원했다.
  - 스크롤 동작은 작은 `BackToTopButton` Client Component로 분리했다.
  - Tooltip provider를 필요한 interactive docs shell로 내렸다.

### [x] README의 빈 shadcn scaffold와 미사용 의존성을 정리한다

- 근거
  - `components.json`은 있으나 `components/ui`가 없다.
  - 정적 앱인데 `@base-ui/react`, `class-variance-authority`가 사용되지 않는다.
- 완료
  - 미사용 직접 primitive 의존성을 제거하고 `@jongminchung/ui`만 사용한다.
  - `components.json`은 공유 primitive 라우팅을 위해 유지한다.
  - fake directory 없이 빈 UI root를 정상으로 처리하는 계약 테스트를 추가했다.

### [ ] 정적 문서 route와 navigation edge case를 결정적으로 만든다

- 근거
  - 정적 문서 집합인데 catch-all page의 `dynamicParams=true`다.
  - `RouteTransition.tsx:88-100`은 동일 URL 검사 전에 4초 timeout progress를 시작한다.
- 변경
  - locale root redirect와 문서 catch-all을 분리하고 `dynamicParams=false`를 검토한다.
  - 동일 URL guard를 공통 `navigate` 함수의 첫 단계로 옮긴다.
- 완료 조건
  - 알려진 문서는 정적 생성되고 미등록 경로는 결정적 404다.
  - 현재 문서 선택은 push/progress를 발생시키지 않는다.

### [ ] 콘텐츠 metadata의 외부 값 경계를 강화한다

- 근거
  - `content-model.ts:117-130`은 `Date.parse` 정규화와 `new URL()`만 사용한다.
  - 존재하지 않는 날짜와 `javascript:` 같은 비 HTTP protocol이 통과할 수 있다.
- 변경
  - 날짜를 parse 후 원문과 round-trip 검증한다.
  - `https:` 중심 protocol allowlist를 적용한다.
- 완료 조건
  - 잘못된 월말/윤일, 위험 protocol 회귀 테스트가 통과한다.

### [ ] 패키지 계약의 소유권과 TypeScript 호환 lane을 명시한다

- 근거
  - `packages/theme-contract/contract.test.ts`는 앱 UI 구현까지 검사하지만 패키지 자체 typecheck 대상이 아니다.
  - 공용 패키지는 TypeScript 7.0.2, Next 앱은 6.0.3을 사용한다.
- 변경
  - theme contract에는 토큰/provider 계약만 남기고 cross-app UI 검사는 루트 integration suite로 이동한다.
  - TypeScript 버전을 정렬하거나 “공용 source export는 최소 TS6 호환” gate를 추가한다.
  - private 앱의 공통 React/UI 버전은 catalog로 일원화한다.
- 완료 조건
  - 모든 패키지가 필터 단위 test/typecheck를 실행할 수 있다.
  - 공용 source export가 최소 지원 compiler에서 검증된다.

## 현재 검증 결과

- 통과
  - root 및 모든 workspace package typecheck
  - root format check와 lint — 기존 `no-control-regex` 경고 1개
  - 공유 UI/package-map 10건, theme contract 8건, Engineering Docs Vitest 17건
  - Engineering Docs와 Git Client production build, README 직접 `next build`
  - Engineering Docs Playwright 24건, README 8건, Git Client 42건
  - `shadcn info`와 `shadcn add button --dry-run`
- 실패
  - Git Client Vitest: 787 통과, 기존 4건 실패
    - 삭제된 `.github/workflows/git-client.yml`, `publish-packages.yml` 기대 3건
    - 현재 환경의 `codex` symlink 해석 차이 1건
  - root Vitest의 범위 밖 package contract/icon 실패 3건
    - `tsdown` 기대 버전 불일치 2건
    - 제거된 앱을 가리키는 icon registry 1건
  - 표준 README build와 `pnpm run icon:check` — 같은 기존 icon registry에서 차단
- 참고
  - root `pnpm run check`는 format/lint/typecheck 통과 후 위 범위 밖 Vitest 7건에서 중단된다.
  - Git Client build는 통과하지만 500KB 초과 chunk 경고가 있다.

## 완료 확인 명령

```bash
pnpm --filter @jongminchung/ui run typecheck
pnpm exec vitest run packages/ui packages/tooling/src/package-map.test.ts
pnpm --dir packages/ui exec shadcn info
pnpm --dir packages/ui exec shadcn add button --dry-run -y
pnpm --filter @jongminchung/engineering-docs run build
pnpm --filter @jongminchung/git-client run build
pnpm --filter @jongminchung/engineering-docs run test:e2e
pnpm --filter @jongminchung/readme run test:e2e
pnpm --filter @jongminchung/git-client run test:e2e
pnpm run icon:check
pnpm check
```

## 공식 기준

- [Next.js Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Tailwind CSS source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [shadcn monorepo 구성](https://ui.shadcn.com/docs/monorepo)
