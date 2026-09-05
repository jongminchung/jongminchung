# Issue 0020: Web과 UI package의 개발·빌드 소비 계약 정리

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `7f4a72b`
- 우선순위: P1
- 기준일: 2026-08-19
- 기준 commit: `f8ece16`
- 영향 범위:
  [Web Next 설정](../../../../apps/web/next.config.ts),
  [Web scripts](../../../../apps/web/package.json),
  [UI package](../../../../packages/ui/package.json),
  [공용 TypeScript 설정](../../../../tsconfig.base.json)
- 참고 OSS:
  [Next.js transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages),
  [Next.js Turbopack](https://nextjs.org/docs/app/api-reference/turbopack),
  [Turborepo Tailwind 가이드](https://turborepo.dev/docs/guides/tools/tailwind),
  [Turborepo source](https://github.com/vercel/turborepo)

## 핵심 요약

- **Web runtime은 UI의 `dist`를 읽지만 TypeScript는 UI의 `src`를 읽도록 두 개의 서로 다른 module graph가 생김**
- **`predev`는 UI를 한 번만 build하고 watch하지 않으므로 개발 서버 실행 뒤 UI source 변경이 Fast Refresh에 반영되지 않음**
- **11개 subpath를 수동 alias한 목록은 새 primitive import가 추가될 때 source·dist 소비가 섞이는 drift를 만듦**
- **Next.js와 Turbopack은 local package transpilation과 `tsconfig.paths`를 기본 지원하므로 현재 수동 alias는 일반적인 OSS 계약보다 복잡함**
- **source-first 또는 dist-first 중 하나를 명시적으로 선택하고 dev·typecheck·build가 같은 graph를 사용하도록 정리해야 함**

## OSS 기준에서 확인한 계약

- **Next.js는 `transpilePackages`를 local monorepo package를 transpile하고 bundle하는 공식 경로로 제공함**
    - package 이름 하나를 설정해 subpath 전체에 같은 정책을 적용함
    - component별 alias 목록을 consumer config에 반복하지 않음
- **Turbopack은 `tsconfig.json`의 `paths`와 `baseUrl`을 읽고 source 변경에 Fast Refresh를 제공함**
    - 현재 root `tsconfig`는 `@jongminchung/ui/*`를 `packages/ui/src/*`로 연결함
    - 수동 `resolveAlias`가 이 source 경로를 `dist`로 다시 덮음
- **compiled package를 소비하는 Turborepo 사례는 package build watcher를 dev task graph에 포함함**
    - one-shot predev만으로 생성물을 고정하지 않음
    - app과 package의 지속 실행 task가 함께 source 변경을 추적함

## 현재 저장소의 문제

- **Web의 정적 검사와 runtime build가 다른 파일을 읽음**
    - `tsc`: `packages/ui/src/components/*.tsx`
    - Turbopack: `packages/ui/dist/components/*.js`
    - source와 dist가 어긋나면 typecheck 결과와 실제 화면이 달라질 수 있음
- **개발 시작 시점 이후의 UI 변경이 stale dist에 가려짐**
    - `predev`는 UI `build`를 한 번 실행함
    - UI package에는 `dev` 또는 `build --watch` script가 없음
    - Next dev server가 import하는 파일은 `dist`이므로 `src` 편집을 관찰할 이유가 없음
- **수동 alias inventory가 공용 package export와 독립적으로 증가함**
    - 현재 Web이 소비하는 11개 subpath만 열거됨
    - 새 component는 alias 누락 여부에 따라 package export 또는 TypeScript path로 해석될 수 있음
    - CSS subpath는 source를, JavaScript subpath는 dist를 읽는 혼합 정책이 됨
- **clean build 통과는 개발 계약의 정확성을 증명하지 않음**
    - `prebuild`가 직전에 dist를 만들기 때문에 production build는 통과함
    - Fast Refresh와 source·runtime 일치 여부는 별도 검증이 필요함

## 채택할 내용

- **Web은 source-first 소비를 우선 검토함**
    - `@jongminchung/ui`를 package 단위로 `transpilePackages`에 연결함
    - 기존 `tsconfig.paths`와 package subpath export가 같은 source를 가리키도록 함
    - component별 `resolveAlias`와 Web의 UI one-shot prebuild를 제거할 수 있는지 clean clone에서 검증함
- **dist-first를 유지해야 한다면 UI watch task를 명시적으로 추가함**
    - `tsc --watch` 또는 동등한 지속 build가 Next dev와 함께 실행되어야 함
    - TypeScript도 declaration 또는 dist와 같은 공개 graph를 검사해야 함
    - alias inventory 대신 package export map을 단일 기준으로 사용함
- **선택한 계약을 문서와 smoke test로 고정함**
    - UI component source 변경이 열린 Web 화면에 반영됨
    - 새 UI subpath를 추가해도 Next config 목록 수정이 필요하지 않음
    - clean checkout에서 UI dist가 없어도 의도한 명령이 성공함

## 채택하지 않을 내용

- **component가 추가될 때마다 Web `next.config.ts` alias를 수동 확장하지 않음**
- **source typecheck와 stale dist runtime의 불일치를 허용하지 않음**
- **단일 workspace 명령을 전달하기 위한 새 루트 별칭을 만들지 않음**
- **Web dev를 여러 앱과 암묵적으로 결합하는 범용 루트 `dev`를 추가하지 않음**

## 완료 조건

- **Web dev·typecheck·build가 UI의 같은 module graph를 사용함**
- **UI source 변경이 Web dev 재시작 없이 반영됨**
- **새 UI subpath가 consumer별 alias inventory 없이 해석됨**
- **clean checkout과 stale dist 상태에서 명령 결과가 결정적임**
- **UI package의 publish용 `dist` 계약은 Web 내부 개발 계약과 충돌하지 않음**

## 검증

- **clean 상태와 watch 상태를 모두 확인함**
    - `pnpm --filter @jongminchung/ui run typecheck`
    - `pnpm --filter @jongminchung/ui run build`
    - `pnpm --filter @jongminchung/web run typecheck`
    - `pnpm --filter @jongminchung/web run build`
    - `pnpm --filter @jongminchung/web run dev`
- **dev server 실행 중 UI source를 변경하고 browser 반영과 Fast Refresh를 확인함**
- **최종 `pnpm run check`, `git diff --check`, `git status --short`를 실행함**

## 구현 결과

- **Web을 `@jongminchung/ui` source-first 소비로 통합함**
    - component별 Turbopack alias 11개를 `transpilePackages` 하나로 대체함
    - Web의 UI one-shot `predev`·`prebuild`를 제거함
    - UI 내부 import를 package self-reference로 통일함
- **clean `dist`와 watch 상태를 모두 확인함**
    - UI `dist`가 없는 상태에서 Web production build가 통과함
    - 실행 중인 Web dev server가 UI source 변경을 재시작 없이 반영함
    - UI publish dry run과 루트 전체 검사가 통과함
