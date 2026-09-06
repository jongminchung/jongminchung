# 시리즈 글 작성하기

시리즈는 Tech Blog 글을 등록된 ID와 회차로 묶는 기능이다. 각 편은
[블로그 작성 절차](write-blog.md)에 따라 한영 MDX로 작성한다. 별도 시리즈 MDX
폴더나 Docs `meta.json`으로 회차를 관리하지 않는다.

## 시리즈 구성 정하기

먼저 독자, 전체 목표, 각 편의 질문과 결과를 정한다. 한 편에서 한 질문을 마무리하고
다음 편에서 필요한 전제나 결과를 끝부분에 연결한다. 각 편의 `thesis`와
`counterargument`는 해당 편의 내용을 설명해야 한다.

기존 시리즈는 [series.ts](../../apps/web/lib/tech/series.ts)의 `seriesRegistry`에서
ID를 찾는다. 같은 주제에 이어 쓰는 경우 기존 ID를 사용한다.

## 새 시리즈 등록하기

새 시리즈라면 `seriesRegistrySchema.parse({ ... })`의 객체 안에 다음과 같은 항목을
추가한다. 아래는 작성용 예제이며 아직 등록된 시리즈가 아니다.

```ts
"cache-design": {
  order: 3,
  title: {
    ko: "캐시 설계와 검증",
    en: "Cache Design and Validation",
  },
  description: {
    ko: "읽기 성능 측정부터 무효화와 장애 대응까지 캐시 설계 기준을 검증한다.",
    en: "Validate cache design choices from read performance to invalidation and failure handling.",
  },
},
```

ID는 소문자 영문·숫자·하이픈으로 정한다. `title`과 `description`은 두 언어 모두
필요하며 `order`는 0 이상의 정수다. 기존 목록을 보고 원하는 위치의 값을 정한다.
`order`는 시리즈 목록의 정렬 값이고 각 글의 `seriesOrder`와 다르다.
[이전 Docs 시리즈 ID](../../apps/web/lib/tech/routing.ts)는 Docs로 리다이렉트되므로
새 Blog 시리즈 ID로 재사용하지 않는다.

## 각 편 연결하기

각 글의 frontmatter에 아래 두 필드를 **함께** 추가한다. 앞의 등록 예제를 적용했을
때 사용할 수 있는 값이다.

```yaml
series: cache-design
seriesOrder: 1
```

다음 편에는 같은 `series`와 `seriesOrder: 2`를 사용한다. 한영 번역은 같은 시리즈와
회차를 사용해야 한다. 회차는 양의 정수이며 같은 언어·시리즈 안에서 초안을 포함해
중복할 수 없다. 기존 회차는 다음처럼 확인한다.

```sh
rg -n '^series(Order)?:' apps/web/content/tech/blog
```

각 편의 파일명은 독립된 글 ID다. 예를 들어 `cache-invalidation-notes.mdx`의 URL은
시리즈에 넣어도 `/ko/cache-invalidation-notes`로 유지된다. 글 URL을 시리즈 아래로
옮길 필요가 없다. 본문에서 이전·다음 편을 안내할 때도 각 글의 공개 URL을 사용한다.

## 미리보기와 순차 발행

시리즈 목록은 `/ko/series`, 상세는 `/ko/series/cache-design`이며 영어는 `/en/…`이다.
상세의 글은 `seriesOrder` 오름차순으로 표시된다. 공개된 글만 포함되므로 두 언어의
발행 상태가 다르면 표시되는 편수도 달라질 수 있다. 등록 정보에는 공개 상태 필드가
없으므로, 등록 자체를 시리즈 소개를 숨기는 수단으로 사용하지 않는다.

순차 발행할 때는 준비된 편만 `publicationStatus: published`로 바꾸고 나머지는
`draft`로 유지한다. 공개된 글에서 아직 비공개인 다음 편으로 연결하는 링크는
해당 편을 발행할 때 추가한다. 회차 사이의 숫자가 비는 것 자체는 오류가 아니다.

[공통 검증·발행 절차](content.md)를 실행하고 두 언어의 목록 제목·설명·편수, 상세의
순서와 글 링크를 확인한다. 새 편을 추가하면 Blog 개수 계약도 갱신한다. 기존 글을
시리즈에 넣는 작업은 파일 개수를 바꾸지 않는다. 회차 중복·미등록 ID 오류는 개수
기대값을 바꾸는 것으로 해결되지 않는다.
