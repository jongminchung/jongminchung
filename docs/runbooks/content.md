# 콘텐츠 편집과 발행

모든 경로와 명령은 저장소 루트 기준이다. 원본 MDX를 직접 편집하고 이미지 편집기로
자산을 준비할 수 있다. AI 글쓰기·이미지 생성 도구는 이 절차의 선행 조건이 아니다.

## 새 글 작성 안내

- [블로그 글 작성하기](write-blog.md): 주제 선정, 한영 MDX 예제, 필수 필드와 본문 구성
- [시리즈 글 작성하기](write-series.md): 시리즈 등록, 회차 연결과 순차 발행
- [공식 문서 작성하기](write-docs.md): 문서 유형, 검증 근거, Docs 경로와 Sidebar 구성

위 안내로 원고를 작성한 뒤 이 문서의 공통 검증·발행 절차를 따른다.

## 수정할 원본 찾기

| 종류      | 원본                                                            | 공개 경로                        |
| --------- | --------------------------------------------------------------- | -------------------------------- |
| Tech Blog | `apps/web/content/tech/blog/{ko,en}/<id>.mdx`                   | Tech의 `/{locale}/{id}`          |
| Tech Docs | `apps/web/content/tech/docs/{ko,en}/<area>/*.mdx`와 `meta.json` | Tech의 `/{locale}/docs/{area}/…` |
| Invest    | `apps/web/content/invest/{ko,en}/notes/<id>.mdx`                | Invest의 `/{locale}/notes/{id}`  |

파일을 찾을 때 제목이나 본문 일부를 검색한다.

```sh
rg -n '찾을 문구' apps/web/content
```

`ko`와 `en` 파일을 함께 확인한다. 파일명 변경은 공개 URL 변경이므로 기존 내부
링크와 외부 유입 경로도 조사한다. 경로를 바꿔야 한다면 이전 URL 처리 방침과
routing 회귀 검증을 함께 준비한다.

## Tech Blog·Docs 추가하기

1. 같은 종류의 기존 `ko`·`en` MDX를 읽고 새 파일을 만든다. Blog의 파일명은
   소문자 영문·숫자와 하이픈으로 된 ID다. Tech의 `id`, `locale`, Docs `area`는
   경로에서 파생되므로 frontmatter에 임의로 추가하지 않는다.
2. 제목·요약·본문·태그·출처를 작성하고 날짜를 실제 변경 이력에 맞춘다.
   `updatedAt`은 `publishedAt`보다 빠를 수 없다. `verifiedAt`을 적는다면
   `updatedAt` 이상이어야 한다. Docs에는 `verifiedAt`이 필수다.
3. Blog에는 `thesis`, `counterargument`가 필요하다. 시리즈를 쓸 때는
   [series.ts](../../apps/web/lib/tech/series.ts)에 등록된 `series`와 양의 정수
   `seriesOrder`를 함께 지정한다. 같은 언어·시리즈에서 순서를 중복하지 않는다.
4. Docs는 같은 영역의 문서 유형과 `meta.json` 탐색 순서를 확인한다.
   개요와 일반 문서는 경로 규칙이 다르므로 `index.mdx`를 일반 문서처럼 복사하지 않는다.
5. 처음에는 `publicationStatus: draft`로 저장한다. Tech의 `status`는
   `stable`, `deprecated`, `experimental` 중 문서 상태이며 공개 여부와 별개다.

필드의 최종 기준은 [content-model.ts](../../apps/web/lib/content-model.ts),
경로·번역·본문 규칙은 [content-validation.ts](../../apps/web/lib/content-validation.ts)다.
한영 Tech 문서는 같은 ID를 가져야 하며 `status`, `tags`, 패키지·API 관련 필드,
Blog 시리즈·순서, Docs 영역·문서 유형의 일치 여부를 검사한다.
Tech는 언어별 공개 상태를 별도로 둘 수 있다. 번역 파일 자체는 필요하다.

## 투자 노트 추가하기

[한국어 양식](../../apps/web/content/invest/templates/note.ko.mdx.example)과
[영어 양식](../../apps/web/content/invest/templates/note.en.mdx.example)을 각각
`content/invest/ko/notes/<id>.mdx`, `content/invest/en/notes/<id>.mdx`로 복사한다
(이 두 경로는 `apps/web` 기준).

양식의 예시 ID·날짜·출처·이미지를 실제 값으로 바꾸고 선택적 `series`는 필요할 때만
남긴다. Invest는 frontmatter에 `id`, `locale`을 명시하고 `status: draft` 또는
`status: published`로 공개 여부를 정한다. Tech의 `publicationStatus`를 사용하지 않는다.

출처는 하나 이상 필요하다. `kind`는 `book`, `social`, `video`, `interview`,
`article` 중 하나이며 책 이외에는 인증정보 없는 HTTPS URL이 필수다.
본문은 일반 Markdown으로 작성한다. `SourceSummary`, `JamieNotes` 전용 태그는
검증에서 거부한다. 자세한 필드는 [Invest schema](../../apps/web/lib/invest/content.ts)를 본다.

한영 파일의 `publishedAt`, `status`, `tags`, `series`, `image`는 같아야 한다.
제목·본문·대체 텍스트는 각각 번역한다.

## 이미지 직접 준비하기

기존 이미지와 같은 용도·크기를 확인한 뒤 직접 제작하거나 사용 권한이 있는 PNG를
저장한다. 이미지 생성 skill을 실행할 필요는 없다.

| 용도           | 파일                                     | 참조                                                |
| -------------- | ---------------------------------------- | --------------------------------------------------- |
| Tech 글 이미지 | `apps/web/public/tech/articles/<id>.png` | ID에서 `/tech/articles/<id>.png` 생성               |
| Invest 이미지  | `apps/web/public/invest/<id>.png`        | frontmatter의 `image: /invest/<id>.png`, `imageAlt` |

본문 이미지는 기존 MDX component 사용 예를 따른다. 밝은·어두운 테마 모두에서
가독성을 확인하고 출처·사용 권한을 기록한다. Excalidraw와 폰트는
[생성물 안내](../web/README.md)를 따른다.

## 검증하고 공개하기

```sh
bun run --filter @jongminchung/web postinstall
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/web test
bun run --filter @jongminchung/web build
```

`postinstall`은 새 MDX의 `.source` entry를 생성한다. build는 entry 재생성,
콘텐츠 검증, Excalidraw 검사와 Next build를 수행한다. `.source`, `.next`,
검색 결과를 직접 수정하지 않는다. `docs`의 Markdown 링크 검사만으로 MDX 검증을
대체할 수 없다.

초안은 공개 페이지에서 보이지 않는 것이 정상이다. 본문 미리보기는 로컬 작업
브랜치에서 공개 상태로 바꾸어 확인하고, 초안으로 제출할 때는 그 상태를 되돌린다.
초안도 저장소에 저장되므로 비밀정보를 넣지 않는다.

발행할 때는 Tech의 `publicationStatus` 또는 Invest의 `status`를 `published`로
바꾸고 위 검사를 다시 실행한다. Tech 공개 문서의 차단용 TODO·FIXME 주석을 해결한다.
두 언어의 목록·본문·이미지·언어 전환·관련 링크를 확인하고, Tech 검색·Docs sidebar,
해당 사이트의 feed·sitemap에도 의도대로 노출되는지 확인한다.
공개 상태·URL 규칙을 바꿨다면 관련 E2E도 실행한다.

콘텐츠 개수는 고정하지 않는다. 새 글은 한영 번역 쌍과 고유 ID·URL, 필수 Docs 영역을
유지하면 validator의 숫자 변경 없이 추가할 수 있다. 공개 Tech 문서의 내부 링크는
공개된 문서만 대상으로 삼아야 한다. 초안은 다른 초안을 참조할 수 있다.

기존 Docs 누락은 build에서 `apps/web/scripts/tech-docs-baseline.json`의 상대 경로
목록으로 검사한다. 이 목록은 2026-09-06의 기존 문서를 보존하기 위한 기준이며 새 글을
추가할 때 갱신하지 않는다. 기존 문서를 의도적으로 삭제하거나 경로를 변경할 때만
이동·삭제 이유와 함께 기준 목록을 조정하고 해당 문서의 참조 링크도 갱신한다.
Web `test`·`build`와 루트 `check`로 번역·URL·공개 링크 계약을 검증한다.

Tech와 Invest는 각 도메인의 메타데이터 snapshot을 독립적으로 검증·재사용한다.
production에서는 각 snapshot을 캐시하고 development에서는 콘텐츠 변경을 반영하기
위해 다시 읽는다. 전체 production build는 두 도메인을 모두 검증한다.

production은 빌드된 콘텐츠를 사용한다. Git 수정만으로 운영 화면이 바뀌지는 않으며
[배포 절차](release.md)를 거쳐야 한다. 발행 취소도 공개 상태를 수정하고 다시 검증·
배포한다. 삭제·비공개 전환 후에는 해당 URL과 목록·검색·feed의 노출을 확인한다.
