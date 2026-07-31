# 모노레포 제품·배포·UI 개선 TODO

## 판단 요약

- 남은 항목을 장애 위험, 접근성 계약, 측정 가능한 성능, 구조적 취향으로 다시 분류했다.
- 실제 결함은 renderer persistence 한 가지다. App 전체 재작성, 모든 dialog lazy화, Tailwind registry 전면
  해체와 test 파일 이동은 독립 프로젝트로 진행하지 않는다.

| 영역           | 판단                | 핵심 피드백                                                                                                     |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| React/TS       | P0 결함 1건         | read 실패 뒤 기본값을 저장할 수 있다. 기능 경계 분리는 이 결함을 고치는 첫 slice부터 제한적으로 진행한다.       |
| Next.js        | P2 접근성 보완      | App Router/RSC/Metadata 구성은 충분하다. locale별 root `<html lang>`만 서버 응답에서 바로잡는다.                |
| 성능           | 측정 후 조건부      | Vite 경고나 gzip 크기만으로 분할하지 않는다. packaged Electron startup 병목이 renderer일 때만 기능 묶음을 뺀다. |
| Tailwind CSS   | 작은 dead code 정리 | 미사용 40개 recipe는 제거하되, 사용 중인 제품 layout을 다른 스타일 체계로 다시 쓰지 않는다.                     |
| shadcn/Base UI | 전환 완료           | `@jongminchung/ui`가 primitive를 소유하고 앱은 테마, 제품 조합과 플랫폼 동작을 소유한다.                        |

## 지속 계약

- `packages/ui`는 shadcn primitive, `cn`, 공통 Tailwind 진입점만 소유한다.
  - 앱은 `theme.css`, 제품 컴포넌트, 플랫폼 동작과 시각 언어를 계속 소유한다.
- `packages/theme-contract/src/tokens.css`는 값 없는 CSS-only 의미 토큰 계약으로 유지한다.
- 앱별 `theme.css`에서 완전한 OKLCH provider 값을 정의한다.
- Tailwind를 모든 레이아웃에 강제하지 않고 CSS Module과 역할을 나눈다.
- Next 앱은 Server Component를 기본으로 하고 상호작용만 Client Component로 격리한다.
- `Excalidraw`, CodeMirror, xterm 등 무거운 기능은 필요 시점에 적재한다.
- `unknown` 입력 검증, readonly 모델, Axe·키보드·CLS·비주얼 회귀 검증을 유지한다.
- 앱 E2E는 명시적 로컬/릴리스 검증 명령으로 유지한다.
- 모든 workspace는 catalog의 최신 안정 TypeScript 6 한 버전을 사용한다. TS 7 dual lane은 만들지 않는다.
- contract test는 동작, public API와 import 경계를 검증한다. 파일 위치나 정확한 구현 문자열만 감시하는
  테스트는 추가하지 않는다.

## 다음 실행 순서

1. **P0 persistence**: read 실패 뒤 자동 저장을 막고 durable write 오류를 복구 가능하게 만든다.
2. **P1 첫 feature boundary**: persistence controller와 search/inspection 한 묶음만 App에서 추출한다.
3. **P2 locale root**: locale별 root layout으로 raw HTML의 기본 언어를 바로잡는다.
4. **P2 startup 측정**: 병목을 측정하고 renderer가 원인일 때만 1~3개 기능 묶음을 분할한다.
5. **P2 Tailwind dead code**: 실제 미사용 recipe 40개만 제거하고 전면 스타일 재작성은 하지 않는다.

## P0: 데이터 무결성

### [ ] Electron renderer persistence의 hydration과 저장 실패를 안전하게 처리한다

- 근거
  - `App.tsx`의 product settings, layouts, macros와 project defaults는 read 실패 뒤에도
    `loaded=true`가 되어 메모리 기본값을 저장한다.
  - scratch files, repository UI state와 bookmarks에도 같은 restore-then-write 패턴이 있다.
  - 여러 write Promise가 실패를 조용히 버리므로 사용자는 durable 설정이 저장되지 않았다는 사실을
    알 수 없다.
  - main process의 `SettingsStore`는 이미 atomic write와 write queue를 제공한다. 새 직렬화 계층이
    아니라 renderer의 hydration 상태 구분이 필요하다.
- 변경
  - `loaded: boolean`을 `loading | ready | readError` discriminated union으로 바꾼다.
  - key 없음인 `null`은 정상 hydration으로, IPC/read rejection은 저장 금지 상태로 구분한다.
  - read 실패 중에도 기본 UI는 사용할 수 있게 하되 retry 또는 명시적 reset 전에는 자동 저장하지 않는다.
  - product settings, layouts, macros, project defaults, scratch files, repository UI, bookmarks와 workspace
    session의 read/write pair를 같은 계약으로 감사한다.
  - product settings, macros와 bookmarks 같은 durable data의 write 실패는 사용자에게 알리고 재시도를
    제공한다. 일시적 layout 상태는 진단 로그에 남긴다.
  - IPC는 `AbortSignal`을 받지 않으므로 가짜 취소 API를 만들지 않는다. cleanup flag 또는 generation으로
    stale read 결과만 무시한다.
- 완료 조건
  - read 실패 뒤 어떤 기본값 write도 발생하지 않는다.
  - missing value, read error, write error, retry, unmount와 repository key 변경 테스트가 통과한다.
  - persistence 경로에 오류 처리 없는 floating Promise와 조용히 삼키는 catch가 없다.

## P1: React/TypeScript 기능 경계

### [ ] Git Client App/session의 첫 두 feature boundary만 분리한다

- 근거
  - `src/App.tsx`는 현재 7,635줄이고 `RepositoryWorkspace`가 약 5,200줄을 차지한다.
  - `src/hooks/useGitSession.ts`는 2,292줄이고 90개가 넘는 read/command 값을 한 번에 반환한다.
  - `GitSession = ReturnType<typeof useGitSession>`가 구현 전체를 하위 component 계약으로 노출한다.
  - 파일 크기는 유지보수 신호지만, interface 분리나 selector 도입만으로 render 성능이 개선되지는 않는다.
- 변경
  - 첫 slice로 persistence와 DOM theme 적용을 `useProductSettingsController` 경계로 추출한다.
  - 두 번째 slice로 `RepositoryWorkspace`의 search/inspection 상태와 명령을 feature controller로 추출한다.
  - 추출된 component에는 전체 `GitSession` 대신 명시적인 readonly read model과 command port를 전달한다.
  - `useGitSession` 구현을 한 번에 다시 쓰거나 외부 store를 도입하지 않는다. activity, Git console,
    terminal 같은 고빈도 경계는 Profiler 근거가 있을 때만 별도 subscription으로 분리한다.
  - 기존 `useAppDialog`처럼 이미 분리된 controller는 다시 추상화하지 않는다.
- 완료 조건
  - `AppContent`가 persistence Effect를 직접 소유하지 않는다.
  - search/inspection 상태 전이와 persistence 실패를 독립적으로 테스트할 수 있다.
  - 두 slice의 consumer가 `ReturnType<typeof useGitSession>`에 의존하지 않는다.
  - 두 slice 이후 이 TODO를 닫고, 나머지 추출은 해당 기능을 변경할 때 수행한다.

## P2: Next.js 접근성·측정 기반 유지보수

### [x] Engineering Docs의 기본 문서 언어를 서버 HTML에 고정한다

- 근거
  - `engineering-docs/app/layout.tsx`는 한국어 URL도 `<html lang="en">`으로 렌더링한다.
  - 하위 `div lang`과 hydration 후 DOM 수정은 raw HTML과 JavaScript 비활성 환경의 기본 언어를
    바로잡지 못한다.
  - WCAG 3.1.1은 페이지 기본 언어를 programmatically determinable하게 요구한다.
- 변경
  - `[locale]/layout.tsx`를 locale root layout으로 전환해 `<html lang={locale}>`을 직접 렌더링한다.
  - `/`와 `/diagrams/**`는 고정 영어 `(standalone)` root layout으로 이동한다.
  - font, metadata, theme/Excalidraw 초기 script 설정은 공유하되 각 root layout이 `<html>/<body>`를
    명확히 소유한다.
  - nested `div lang`과 `DocsShell`의 `document.documentElement.lang` Effect를 제거한다.
  - 여러 root layout 간 이동은 full page load라는 Next.js 제약이 있다. 현재 Docs에서 diagrams로 가는
    제품 navigation이 없으므로 이 tradeoff를 수용한다.
- 완료 조건
  - raw response 또는 JavaScript 비활성 환경에서 `/ko/**`는 `<html lang="ko">`, `/en/**`는
    `<html lang="en">`이다.
  - `/`, `/diagrams/**`, `/fr/**`, 미등록 문서의 redirect/status/404 계약이 유지된다.
  - locale 전환, production build와 Axe 테스트가 통과한다.
- 결과
  - locale별 root layout과 영어 standalone root layout이 서버 HTML의 `lang`을 직접 소유한다.
  - raw HTML, locale 전환, JavaScript 비활성, 404, production build와 Axe 검증이 통과했다.

### [ ] Git Client startup과 renderer entry 비용을 측정하고 필요할 때만 분할한다

- 근거
  - 현재 main JS는 약 1.33MB raw/361KB gzip, CSS는 약 233KB raw/39KB gzip이다.
  - CodeMirror와 xterm은 이미 lazy chunk다. 남은 Vite 500KB 경고만으로 사용자 지연을 증명할 수 없다.
  - Electron은 로컬 packaged asset을 읽으므로 gzip 크기보다 parse/evaluate, first commit과 utility process
    startup을 구분해 측정해야 한다.
- 변경
  - packaged app에서 app ready, renderer load, first React commit과 interaction ready를 구간별로 측정한다.
  - entry raw size와 parse/evaluate 시간을 utility process startup과 분리해 기록한다.
  - renderer가 병목일 때만 무겁고 드물게 여는 기능 1~3개를 의미 있는 chunk로 묶어 `lazy`로 분리한다.
    모든 dialog를 개별 chunk로 만들지 않는다.
  - 분리한 기능은 hover/focus 또는 open 직전에 preload하고 lazy rejection은 기존 renderer error boundary로
    전달한다.
  - hardware 편차가 큰 로컬 cold-start 절대 시간은 hard gate로 두지 않는다. deterministic entry size는
    budget으로, timing은 같은 환경의 median/p95 회귀 자료로 사용한다.
- 완료 조건
  - 측정 결과와 유지 또는 분할 결정이 기록돼 있다.
  - 분할하지 않아도 renderer 병목이 아니라는 근거와 deterministic bundle budget이 있으면 완료다.
  - 분할했다면 동일 환경의 median/p95가 개선되고 keyboard/focus/package smoke가 유지된다.

### [x] Git Client의 실제 미사용 Tailwind recipe 40개를 제거한다

- 근거
  - `src/styles/tailwind.ts`는 현재 544줄/약 112KB다.
  - 295개 key 중 40개는 정의 외 `tw.<key>` 참조가 없고 `tw[...]` 동적 접근도 없다.
  - 해당 문자열은 사용되지 않아도 Tailwind source 후보와 renderer JS에 남는다.
- 변경
  - 40개 key를 기능 묶음별로 제거하고 build CSS/JS 변화와 시각 회귀를 확인한다.
  - 사용 중인 제품 layout, tree, row와 panel recipe는 유지한다.
  - 이 작업에서 CVA, CSS Module 또는 component-local Tailwind로 전면 이전하지 않는다.
- 완료 조건
  - 정의 외 참조가 없는 recipe가 0개다.
  - Git Client build, theme parity와 주요 workspace Playwright가 통과한다.
  - 제거 전후 entry JS/CSS 크기를 기록하되, 이를 위한 새 source-string gate는 추가하지 않는다.
- 결과
  - recipe는 295개에서 255개로 줄었고 255개 모두 정적 참조된다.
  - entry JS는 raw/gzip 1,329,838/356,630 bytes에서 1,314,370/354,363 bytes로 줄었다.
  - entry CSS는 raw/gzip 232,936/38,083 bytes에서 215,079/35,715 bytes로 줄었다.

## 보류하거나 제거한 항목

- **App/session 전면 재작성**: 제거한다. 줄 수, 모든 leaf의 selector 사용, 외부 store 도입은 완료 기준이
  아니다. 위 두 feature boundary 뒤에는 실제 기능 변경이나 Profiler 근거가 있을 때만 추가 추출한다.
- **모든 dialog/tool window lazy화**: 제거한다. 작은 chunk와 첫 open/focus 복잡성이 늘 수 있으므로 startup
  측정이 renderer 병목을 보여줄 때만 제한적으로 적용한다.
- **Tailwind registry 전면 해체**: 제거한다. 현재 사용 중인 제품 layout을 CSS Module이나 CVA로 다시 쓰는
  것은 사용자 가치가 없는 스타일 재작성이다.
- **theme-contract test 파일 이동과 독립 Nx target**: 제거한다. package는 private CSS-only이고 현재 root
  Vitest가 계약을 실행한다. affected-only CI 또는 독립 배포 요구가 생길 때 다시 검토한다.
- **Docs client shell 추가 분리**: 보류한다. MDX 본문은 Server Component `children`으로 유지되고 현재 route
  JS 비용 문제가 측정되지 않았다.

## 현재 검증 결과

- 통과
  - root `pnpm check` — format, lint, Nx graph, typecheck, Vitest 881건, release
    Node script 22건, icon check와 모든 workspace build
  - root format check와 lint — 기존 `no-control-regex` 경고 1개
  - 공유 UI/package-map 10건, theme contract 8건, Engineering Docs Vitest 31건
  - Git Client Vitest 808건과 production build
  - Engineering Docs와 README production build
  - Engineering Docs Playwright 26건, README 8건, Git Client 42건
  - Electron package와 packaged renderer/preload smoke
  - production audit — high 이상 0건, moderate 2건, low 1건
  - tooling/remark 실제 build와 `publish --dry-run --no-git-checks`
  - `shadcn info`와 7개 공유 primitive `shadcn add --dry-run`
- 참고
  - Git Client build는 통과하지만 500KB 초과 chunk 경고가 있다.

## 완료 확인 명령

```bash
pnpm --filter @jongminchung/ui run typecheck
pnpm exec vitest run packages/ui packages/tooling/src/package-map.test.ts
pnpm --dir packages/ui exec shadcn info
pnpm --dir packages/ui exec shadcn add spinner button empty alert badge dropdown-menu dialog --dry-run -y
pnpm --filter @jongminchung/engineering-docs run build
pnpm --filter @jongminchung/git-client run build
pnpm --filter @jongminchung/engineering-docs run test:e2e
pnpm --filter @jongminchung/readme run test:e2e
pnpm --filter @jongminchung/git-client run test:e2e
pnpm --filter @jongminchung/git-client run test:scripts
pnpm run audit:prod
pnpm run icon:check
pnpm run check
```

## 공식 기준

- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Next.js Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Internationalization](https://nextjs.org/docs/app/guides/internationalization)
- [Next.js Root Layout](https://nextjs.org/docs/app/api-reference/file-conventions/layout)
- [Next.js Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [React `lazy`](https://react.dev/reference/react/lazy)
- [Vite production build](https://vite.dev/guide/build)
- [WCAG 3.1.1 Language of Page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page)
- [Tailwind CSS source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [shadcn monorepo 구성](https://ui.shadcn.com/docs/monorepo)
