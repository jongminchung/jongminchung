# Issue 0036: Tech 초안의 공개 경계 차단

- 상태: 구현 완료·반영 대기
- 우선순위: P1
- 기준일: 2026-08-20
- 영향 범위:
  [content repository](../../apps/web/lib/content-repository.ts),
  [document queries](../../apps/web/lib/documents.ts),
  [Tech Docs page route](<../../apps/web/app/(tech)/tech/[locale]/docs/[[...slug]]/page.tsx>),
  [Tech sitemap](<../../apps/web/app/(tech)/tech/sitemap.ts>),
  [Tech search index](<../../apps/web/app/(tech)/tech/[locale]/search/route.ts>),
  [`llms.txt`](<../../apps/web/app/(tech)/tech/llms.txt/route.ts>),
  [Home writing](<../../apps/web/app/(home)/_components/HomeWritingSection.tsx>)

## 핵심 요약

- **Tech metadata는 `publicationStatus: draft`를 지원하지만 공개 document query는 상태를 필터링하지 않음**
- **RSS만 published 문서를 선택하고 page·navigation·Home·검색·sitemap·`llms.txt`는 전체 문서를 사용함**
- **현재 실제 Tech corpus는 모두 published이므로 결함이 드러나지 않지만 초안 한 쌍을 추가하면 공개 표면에 포함될 수 있음**
- **source validation용 전체 collection과 사용자에게 제공할 published collection을 명시적으로 분리해야 함**
- **인증된 preview 요구가 없는 현재 제품에서는 draft route를 404로 처리하는 것이 안전한 기본값임**

## 현재 문제와 근거

- **source 계약과 public query 계약의 의미가 다름**
  - `publicationStatuses`는 `published`와 `draft`를 허용함
  - `validateDocuments`는 published 문서에만 blocking TODO를 금지해 draft 작성 workflow를 명시적으로 지원함
  - `createContentSnapshot`은 상태와 무관하게 모든 source document를 `documents`에 포함함
- **공개 document helper가 전체 collection을 그대로 반환함**
  - `getDocuments`는 snapshot의 모든 문서를 반환함
  - `getLocalizedDocuments`·`getSectionDocuments`·`findDocument`·`loadDocument`가 같은 전체 collection을 사용함
  - 이름만으로 validation용 raw collection과 public collection을 구분할 수 없음
- **draft가 여러 사용자·crawler 표면으로 전파될 수 있음**
  - page `generateStaticParams`와 route lookup이 draft URL을 생성하고 렌더링할 수 있음
  - navigation·section landing·related documents와 Home 최근 글이 draft를 포함할 수 있음
  - search index·sitemap·`llms.txt`와 OG route가 draft metadata 또는 본문을 노출할 수 있음
  - RSS만 `publicationStatus === "published"`를 직접 검사해 다른 consumer와 비대칭임
- **실제 draft fixture가 없어 회귀가 감지되지 않음**
  - 현재 Tech content 64개는 모두 published임
  - content validation test는 draft의 TODO 허용만 검증함
  - public selector와 metadata route test는 draft 제외를 검증하지 않음

## 채택할 내용

- **전체 source collection과 published public collection을 별도 API로 제공함**
  - locale pair·navigation order·internal link validation은 전체 source collection에서 수행함
  - page·navigation·검색·discovery consumer는 published collection만 사용함
  - public 함수 이름 또는 type으로 draft 포함 여부를 식별할 수 있게 함
- **공개 surface의 상태 정책을 하나의 selector에서 공유함**
  - page route와 `generateStaticParams`
  - section landing·navigation·related documents·Home writing
  - search index·sitemap·RSS·`llms.txt`·OG image
- **작은 published·draft bilingual fixture로 경계를 검증함**
  - 전체 source collection에는 두 상태가 모두 존재함
  - public collection에는 published 문서만 존재함
  - draft URL lookup은 null 또는 404 결과를 반환함
  - discovery output에는 draft ID·title·body가 존재하지 않음

## 채택하지 않을 내용

- **draft를 보기 위한 인증 없는 query parameter나 숨은 public route를 추가하지 않음**
- **개발 환경이라는 이유만으로 production과 다른 공개 URL 계약을 기본 활성화하지 않음**
- **draft source file을 별도 디렉터리로 이동해 metadata 상태와 파일 위치를 이중 관리하지 않음**
- **현재 published 문서의 URL·정렬·검색 ranking·RSS 결과를 변경하지 않음**
- **Investment note의 이미 차단된 draft 경계를 다시 구현하지 않음**

## 실행 작업

- **content repository에 validation용 전체 collection과 published selector를 분리함**
- **public document helper가 published collection을 기본 사용하도록 변경함**
- **RSS의 개별 상태 filter를 공통 public selector로 대체함**
- **page·navigation·Home·search·sitemap·`llms.txt`·OG consumer를 inventory해 public selector 사용을 고정함**
- **published·draft fixture와 public discovery contract test를 추가함**
- **실제 published corpus의 route·검색·feed output이 변경되지 않았음을 확인함**

## 완료 조건

- **draft 문서가 직접 URL에서 404이며 정적 route parameter로 생성되지 않음**
- **draft ID·title·body가 navigation·Home·search index·sitemap·RSS·`llms.txt`·OG output에 포함되지 않음**
- **draft source는 locale·metadata·internal link validation 대상에 계속 포함됨**
- **published 문서의 URL·navigation order·검색 baseline·feed 결과가 유지됨**
- **public consumer가 raw source collection을 직접 사용할 수 없는 명확한 API 경계를 가짐**

## 검증

- `pnpm --filter @jongminchung/web run typecheck`
- `pnpm --filter @jongminchung/web run test`
- `pnpm --filter @jongminchung/web run build`
- draft route·navigation·search·metadata focused test
- `pnpm run check`
- `git diff --check`

## 처리 결과

- **content snapshot을 `sourceTech`와 `publishedTech` collection으로 분리함**
  - locale pair·metadata·path·내부 링크와 evidence 검사는 draft를 포함한 전체 source collection을 사용함
  - page·Home·관련 문서·sitemap·RSS·`llms.txt`·OG consumer는 published getter만 사용함
- **검색과 Docs navigation도 같은 publication selector를 적용함**
  - Fumadocs 검색 source는 published page만 색인해 draft title·body·alias가 결과에 포함되지 않음
  - Fumadocs page tree는 published URL 집합으로 필터링해 draft page와 빈 folder를 제거함
- **draft 직접 URL과 정적 route 생성을 published lookup으로 차단함**
  - Blog·Docs `generateStaticParams`와 lookup은 published collection만 사용함
  - draft lookup은 null이 되어 기존 page route의 `notFound()` 경계로 연결됨
- **작은 fixture가 raw와 public collection의 차이와 navigation 제거를 검증함**
  - source fixture에는 published·draft가 모두 남고 public fixture에는 draft ID·title·body가 없음
- **검증 결과는 publication·document·metadata·`llms.txt`·evidence unit 5개 파일·15개 test 통과임**
  - 실제 bilingual 검색 corpus integration과 Web 전체 31개 파일·121개 test가 통과함
  - 48 Blog·58 Docs source validation과 354개 route production build가 통과함
