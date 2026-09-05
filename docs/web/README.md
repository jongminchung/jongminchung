# Web 앱 구조와 직접 유지보수

`apps/web`은 하나의 Next.js 앱으로 Home, Tech, Invest를 제공한다. 모든 명령은
저장소 루트에서 실행한다. 설치는 [기여 가이드](../../CONTRIBUTING.md),
검증 기준은 [Web 테스트 전략](../web-testing-strategy.md)을 참고한다.

## 먼저 실행하기

```sh
bun install --frozen-lockfile
bun run --filter @jongminchung/web dev:tech
```

`http://localhost:3000/en` 또는 `/ko`에서 확인한다. Home과 Invest는 각각
`dev:home`, `dev:invest`로 실행한다. `JAMIE_LOCAL_SITE`는 개발용 loopback
host에만 적용된다.

## 요청이 화면에 도달하는 경로

| 공개 요청                          | 내부 경로                  | 페이지 파일                                          |
| ---------------------------------- | -------------------------- | ---------------------------------------------------- |
| `www.jamie.kr/en`                  | `/home/en`                 | `app/(home)/home/[locale]/page.tsx`                  |
| `tech.jamie.kr/en/example`         | `/tech/en/example`         | `app/(tech)/tech/[locale]/(blog)/[slug]/page.tsx`    |
| `tech.jamie.kr/en/docs/fe/example` | `/tech/en/docs/fe/example` | `app/(tech)/tech/[locale]/docs/[[...slug]]/page.tsx` |
| `invest.jamie.kr/en/notes/example` | `/invest/en/notes/example` | `app/(invest)/invest/[locale]/notes/[slug]/page.tsx` |

[proxy.ts](../../apps/web/proxy.ts)가 Host를 확인하고
[site-routing.ts](../../apps/web/lib/site-routing.ts)의 규칙으로 rewrite한다.
괄호로 감싼 route group은 URL에 포함되지 않는다. 공개 링크에는 `/tech` 같은
내부 사이트 접두사를 붙이지 않는다. Next가 생성하는 `PageProps`, `LayoutProps`,
`RouteContext`에는 내부 경로를 사용한다.

`/`는 사이트별 locale cookie, `Accept-Language`, 영어 기본값 순서로 언어를
선택해 `307` redirect한다. `/healthz`, Next 자산, 폰트·이미지 등은 rewrite에서
제외된다. 검색은 `/en/search` → `/tech/en/search`로 처리한다. RSS·sitemap·OG도
각 사이트의 route가 제공한다. `/sites/*`와 직접 요청한 내부 사이트 경로는 거부한다.

## 작업별 수정 위치

아래 경로는 별도 표시가 없으면 `apps/web` 기준이다.

| 하려는 작업           | 먼저 수정할 곳                                                                                                 | 함께 확인할 것                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Blog 글 추가·수정     | `content/tech/blog/{ko,en}/<id>.mdx`                                                                           | 두 언어의 ID·시리즈 순서, 목록·검색·본문      |
| Docs 문서 추가·수정   | `content/tech/docs/{ko,en}/<area>/*.mdx`, 같은 폴더의 `meta.json`                                              | sidebar 순서, 내부 링크, 번역 문서            |
| 투자 노트 추가·수정   | `content/invest/{ko,en}/notes/*.mdx`                                                                           | `content/invest/templates/` 양식, 출처·시리즈 |
| 상단 메뉴·footer 변경 | Tech의 `_components/DocsShell.tsx`, Invest의 `_components/InvestmentLayout.tsx`, Home의 `_components/`         | 모바일 메뉴, 언어 전환, 링크 목적지           |
| 공통 header·카드 변경 | `components/EditorialChrome.tsx`, `EditorialCard.tsx`                                                          | 세 사이트의 desktop·mobile 화면               |
| 문구·번역 변경        | `lib/tech/copy.ts`, `lib/invest/copy.ts`, `lib/home/content.ts`; 검색 등 client 문구는 `messages/{ko,en}.json` | 같은 키의 두 언어, 접근성 이름                |
| 검색 규칙 변경        | `lib/tech/search.ts`, `search-server.ts`, `search-results.ts`                                                  | 결과·오류 재시도·키보드 선택                  |
| 테마·공용 버튼 변경   | 저장소의 `packages/ui/src/styles/`, `packages/ui/src/components/`                                              | 세 사이트와 공용 UI interaction fixture       |
| 본문 스타일 변경      | `app/mdx-theme.css`, Tech의 `tech-document.css`·`tech-docs.css`, Invest의 `invest-code.css`                    | 직접 진입과 목록에서 본문으로 이동한 경우     |
| 라이브러리 버전 변경  | 루트 catalog, 소비 workspace manifest                                                                          | lockfile, 공식 변경 내역, 전체 검사           |

Client용 JSON과 서버용 `copy.ts`의 구분은 브라우저로 보내는 메시지 범위를 제한하기
위한 것이다. 서버 문구를 바꿀 때 client provider에 전체 사전을 추가하지 않는다.
공용 primitive는 `packages/ui`, 제품별 조합은 앱의 component가 소유한다.

## 콘텐츠와 라이브러리의 역할

```text
content/**/*.mdx + source.config.ts
  → Fumadocs가 .source/ 생성
  → lib/fumadocs-source.ts가 collection 연결
  → lib/content-repository.ts가 검증·공개 상태 적용
  → lib/documents.ts / lib/tech/docs-page.ts / lib/invest/notes.ts
  → page.tsx와 component가 렌더링
```

- Zod schema와 `z.infer`가 frontmatter 검증과 타입을 함께 정의한다. 필드 추가는
  `lib/content-model.ts` 또는 `lib/invest/content.ts`에서 시작하고,
  `content-repository.ts`의 metadata 변환도 확인한다.
- Next는 route 타입과 서버·클라이언트 경계를, Fumadocs는 MDX·검색 엔진·목차 관찰을
  담당한다. 경로 타입을 수동으로 복제하거나 별도 목차 observer를 만들지 않는다.
- `fumadocs-source.ts`의 `server-only`는 콘텐츠를 client에서 가져오는 실수를 빌드에서
  차단한다. Bun 테스트·콘텐츠 CLI는 기존 `scripts/register-content-plugin.ts` preload에서
  이 표시를 서버 모듈로 등록한다. 이 preload는 Next 빌드에 적용되지 않는다.
- Base UI는 dialog·메뉴의 초점과 키보드 동작을, `next-themes`는 테마 동기화를 담당한다.
  제품 component는 공용 UI wrapper의 props로 동작을 조정한다.
- 한영 검색어 정규화, Blog·Docs 결과 통합, 공개 콘텐츠 필터는 제품 규칙이다.
  라이브러리 기본값으로 대체할 때도 기존 검색 결과 계약을 확인한다.
- 콘텐츠 snapshot은 개발 중 다시 만들고 production에서는 프로세스 안에서 재사용한다.
  Docs resolver의 React `cache`는 metadata와 본문이 같은 요청에서 재사용하는 별도
  범위다. 콘텐츠는 빌드·재배포로 반영한다.

## 생성물을 직접 수정하지 않기

| 생성물                                    | 원본                                        | 다시 만드는 명령                                 |
| ----------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| `.source/`                                | MDX와 `source.config.ts`                    | `bun run --filter @jongminchung/web postinstall` |
| `.next/types/`                            | `app/`의 route                              | `bun run --filter @jongminchung/web typecheck`   |
| `generated/`, `public/excalidraw-assets/` | `public/diagrams/`와 MDX의 Excalidraw scene | Web `dev` 또는 `build`                           |
| Playwright 기준 이미지                    | 브라우저 렌더링                             | 의도한 디자인 변경에서만 diff 검토 후 갱신       |

새 MDX 파일이 조회되지 않으면 `.source/`를 재생성한다. Excalidraw는 build 전에 SVG를
생성한다. 검색은 별도 JSON 파일을 편집하지 않고 locale별 검색 route에서 제공한다.
폰트 파생본은 [폰트 안내](../../apps/web/app/fonts/README.md)의 절차로 갱신한다.

## 수정 후 확인하기

```sh
# Web 타입과 규칙부터 확인
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/web test

# 저장소 공통 검사
bun run check

# production build와 세 사이트의 브라우저·시각 회귀 검사
bun run --filter @jongminchung/web test:e2e --workers=2
```

Playwright는 3100 포트에 테스트 서버가 없으면 fixture를 포함한 production build 후
서버를 시작한다. 새 변경을 검사할 때는 이전 서버를 종료해 오래된 build를 재사용하지
않도록 한다. 화면을 바꾸지 않는 리팩터링에서는 기준 이미지를 갱신하지 않는다.

| 실패한 검사               | 먼저 확인할 곳                                         |
| ------------------------- | ------------------------------------------------------ |
| `PageProps`·route 타입    | route 경로와 `.next/types/` 재생성                     |
| frontmatter·번역 오류     | 오류에 표시된 MDX 경로와 schema 필드                   |
| `server-only` import 오류 | Client Component가 콘텐츠 loader를 가져왔는지          |
| Knip 의존성 오류          | 실제 import·CLI·생성 script 사용처; 자동 삭제하지 않기 |
| 브라우저 interaction      | `apps/web/test-results/`의 screenshot·trace와 해당 E2E |
| 시각 회귀                 | 같은 OS·브라우저에서 actual·expected·diff 비교         |

배포 환경과 standalone 실행은 [배포 계약](../../apps/web/DEPLOYMENT.md),
런타임 선택은 [Bun standalone 런타임](bun-standalone-runtime.md)을 참고한다.
