# 블로그 글 작성하기

Tech Blog는 경험과 근거를 바탕으로 하나의 주장을 설명하는 글이다. 여러 편으로
이어지는 글은 [시리즈 작성하기](write-series.md), 설치·운영·API 안내는
[공식 문서 작성하기](write-docs.md)를 따른다. 경로와 명령은 저장소 루트 기준이다.

## 주제와 파일 정하기

독자가 해결하려는 문제, 글의 주장, 그 주장이 성립하지 않는 조건을 먼저 한 문장씩
쓴다. `thesis`에는 주장, `counterargument`에는 실제로 검토할 반론을 적고 본문에서
실험·코드·출처로 답한다. 요약인 `description`에는 독자가 얻을 결과를 적는다.

1. 소문자 영문·숫자·하이픈으로 ID를 정한다. 예: `cache-invalidation-notes`.
2. `apps/web/content/tech/blog/ko/cache-invalidation-notes.mdx`와
   `apps/web/content/tech/blog/en/cache-invalidation-notes.mdx`를 만든다.
3. 같은 ID가 Blog나 Docs에 이미 없는지 검색한다. Blog는 하위 폴더와 `index.mdx`를
   지원하지 않는다. 파일명이 공개 URL이므로 발행 후에는 가급적 유지한다.

```sh
rg --files apps/web/content/tech | rg '/cache-invalidation-notes\.mdx$'
```

한국어 공개 URL은 Tech 사이트의 `/ko/cache-invalidation-notes`, 영어는
`/en/cache-invalidation-notes`다. URL에 `/tech`나 `/blog`를 붙이지 않는다.

## MDX 시작 예제

아래 내용을 한국어 파일에 복사하고 예시 제목·날짜·출처·본문을 실제 내용으로 바꾼다.
`sourceUrl`은 대표 근거의 인증정보 없는 HTTPS URL이며 필수다. 여러 근거는 본문에서
각 주장 가까이에 링크나 각주로 추가한다.

```mdx
---
title: "캐시 무효화 시점을 결정한 과정"
description: "변경 빈도와 오래된 데이터 허용 시간을 기준으로 캐시 정책을 비교한다."
thesis: "캐시 수명은 데이터 변경 빈도와 허용 가능한 지연을 함께 보고 결정해야 한다."
counterargument: "무효화 이벤트를 안정적으로 전달할 수 있다면 시간 기반 만료의 비중을 줄일 수 있다."
publishedAt: "2026-09-06"
updatedAt: "2026-09-06"
tags: [cache, architecture]
status: experimental
publicationStatus: draft
sourceUrl: https://example.com/cache-reference
---

## 핵심 요약

독자가 가져갈 판단 기준과 적용 범위를 쓴다.

## 문제와 환경

증상, 사용한 버전, 입력 규모와 제약을 쓴다.

## 비교와 검증

대안별 코드, 재현 방법, 관찰한 결과를 쓴다. 측정한 사실과 해석을 구분한다.

## 반론과 한계

다른 선택이 더 나은 조건과 아직 확인하지 못한 사항을 쓴다.

## 적용 기준

독자가 자신의 환경에서 선택하고 확인할 순서를 쓴다.
```

영어 파일은 같은 필드를 두고 `title`, `description`, `thesis`, `counterargument`와
본문을 번역한다. `id`와 `locale`은 경로에서 계산하므로 frontmatter에 넣지 않는다.
정의되지 않은 필드도 허용되지 않는다. 일반 글에는 `series`와 `seriesOrder`를 생략한다.

## 메타데이터와 본문 다듬기

| 필드                                          | 작성 기준                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `publishedAt`, `updatedAt`                    | `YYYY-MM-DD` 형식. 수정일은 최초 발행일보다 빠를 수 없다. 초안의 예시 날짜는 실제 발행 시점에 정리한다. |
| `verifiedAt`                                  | Blog에서는 선택 사항. 직접 근거를 확인한 날짜이며 `updatedAt` 이상이어야 한다.                          |
| `tags`                                        | 비어 있지 않은 중복 없는 목록. 한영 파일에서 값과 순서가 같아야 한다.                                   |
| `status`                                      | 문서 상태: `stable`, `experimental`, `deprecated`. 공개 여부와는 별개다.                                |
| `publicationStatus`                           | `draft` 또는 `published`. 두 언어를 각각 발행할 수 있지만 번역 파일은 모두 필요하다.                    |
| `displayTitle`                                | 화면에 별도 제목이 필요한 경우에만 사용한다.                                                            |
| `packageName`, `packageVersion`, `apiSymbols` | 특정 패키지·API를 다룰 때 선택적으로 사용하며 한영 값을 일치시킨다.                                     |

본문은 `##`부터 시작하고 코드 블록에는 언어를 표시한다. Tech 내부 링크는
`/ko/<id>` 또는 `/ko/docs/<area>/<slug>`처럼 공개 경로로 적고 영어 본문에서는
`/en/…`으로 바꾼다. 연결 대상이 공개되어 실제로 열리는지도 확인한다.

이미지는 `apps/web/public/tech/articles/<id>.png`에 준비한다. 별도의 `image` 필드를
추가하지 않는다. MDX 구성 요소는 [기존 구현](<../../apps/web/app/(tech)/_components/mdx-components.tsx>)에
등록된 것을 사용하고, 사용 예는 기존 글을 참고한다.

## 검증하고 발행하기

[콘텐츠 편집과 발행](content.md)의 파일 개수 갱신, 이미지 준비, 검증·미리보기·배포
절차를 따른다. 새 한영 글 한 쌍은 언어별 Blog 기대 개수를 각각 1씩 늘리는 변경이다.
초안도 개수에 포함되므로 MDX 두 파일만 추가하고 끝내지 않는다.

발행 전에는 본문이 `thesis`를 뒷받침하고 `counterargument`를 다루는지, 예시 출처와
날짜를 교체했는지 확인한다. 공개 후에는 두 언어의 글 페이지·목록·검색·이미지·언어
전환을 확인한다. 시리즈 글이라면 시리즈 상세의 회차 순서도 확인한다.
