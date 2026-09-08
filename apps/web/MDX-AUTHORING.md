# 글의 강조와 알림 작성

Tech Blog·Docs·Invest Note에서 같은 문법을 사용한다. 기존 bold·인용문·Callout은 그대로 동작한다.

## 형광펜

```mdx
문제의 핵심은 <mark>실행 시간이 아니라 대기 시간</mark>입니다.

<Highlight>가장 중요한 한 문장입니다.</Highlight>
```

`mark`는 빌드 시 공유 `Highlight`로 연결한다. 별도 import나 색상 class는 필요 없다. 밝은/어두운 테마와 강제 색상 모드를 지원하고, 여러 줄에서도 줄마다 배경이 이어진다. `**bold**`는 중요도, `<mark>`는 독자가 다시 찾을 구절에 사용한다. `==문장==`은 지원하지 않는다.

한 문단 전체보다 짧은 구절이나 한 문장을 강조한다. 색을 보지 못해도 내용이 전달되도록 문장 자체에 의미를 담는다. `mark`가 화면 낭독기에서 별도로 안내된다고 가정하지 않는다.

## GitHub 방식 알림

```mdx
> [!NOTE]
> 이 설정은 프로젝트 전체에 적용됩니다.

> [!TIP]
> 변경 전에 `bun run check`로 현재 상태를 확인하세요.

> [!IMPORTANT]
> 먼저 기존 설정을 백업하세요.

> [!WARNING]
> 실행 중인 작업이 중단될 수 있습니다.

> [!CAUTION]
> 이 명령은 데이터를 삭제합니다. 복구 가능 여부를 먼저 확인하세요.
```

표식은 인용문의 첫 줄에 대문자로 단독 작성한다. ko 경로에서는 참고·팁·중요·주의·경고, en 경로에서는 Note·Tip·Important·Warning·Caution 제목을 표시한다. 아이콘과 제목이 색상의 의미를 보완한다. 정적 본문이므로 `role="note"`를 사용하며, 스크린 리더의 읽기를 중단하는 live alert는 사용하지 않는다.

여러 문단, 링크, 목록, 코드도 넣을 수 있다.

````mdx
> [!TIP]
> 다음 순서로 확인합니다.
>
> 1. [설정 문서](/ko/docs)를 확인합니다.
> 2. 검사를 실행합니다.
>
> ```sh
> bun run check
> ```
````

일반 `>` 인용문, 코드 안의 표식, 알 수 없는 `[!OTHER]`는 변환하지 않는다. 알림은 필요한 위치에 한 개씩 쓰고 연속·중첩 사용을 피한다. 기존 `<Callout title="…" type="info">`를 모두 바꿀 필요는 없다.

## 읽기 UX 개선 기준

- 도입부에서 독자가 얻는 결과와 필요한 사전 지식을 짧게 설명한다. 모든 글에 새 요약 UI를 강제하지 않는다.
- 소제목은 실제 질문이나 작업 단위로 작성하고, 긴 절은 의미가 바뀌는 지점에서 나눈다. 현재 목차와 제목 링크를 활용한다.
- 주장은 본문에 두고, 보충 정보는 각주·알림으로 옮긴다. 핵심 결론을 접힌 영역 안에 숨기지 않는다.
- 표에는 비교 기준과 단위를, 그림에는 독자가 확인할 지점을 설명하는 캡션을 둔다. 모바일에서는 페이지가 아닌 표·코드 영역 안에서 가로 스크롤하게 한다.
- 링크는 “여기”보다 목적지가 드러나는 문구로 작성한다. 외부 링크의 새 창 안내는 사이트 전체 링크 정책과 함께 검토한다.
- 글자 크기 조절이나 읽기 폭 설정은 실제 긴 글의 사용자 피드백을 확인한 뒤 도입한다. 기존 목차·각주 미리보기·맨 위 이동·코드 복사와 중복된 도구를 추가하지 않는다.

문법 기준: [GitHub alerts](https://docs.github.com/ko/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts).

## 부연 설명과 용어집

표준 HTML 문법을 쓰면 공통 스타일로 연결된다. 펼치기는 JavaScript 없이도 동작한다. 용어의 첫 등장에서는 짧게 설명하고, 반복해서 참조할 때 정의의 `id`로 링크한다.

```mdx
<details>
<summary>왜 요청 식별자를 저장하나요?</summary>

재시도된 요청인지 확인하기 위해서입니다.

</details>

<dl>
  <dt id="idempotency">멱등성</dt>
  <dd>같은 작업을 반복해도 한 번 수행한 것과 같은 결과가 되는 성질입니다.</dd>
</dl>

자세한 의미는 [멱등성](#idempotency)을 참고하세요.
```

같은 요소를 `<Details>`, `<Summary>`, `<Glossary>`, `<Term>`, `<Definition>`으로도 쓸 수 있다. 정의 위치의 id는 문서 안에서 고유하게 작성한다. 핵심 결론·경고는 접지 않는다.

## 코드 줄과 설명 연결

현재 Shiki/Fumadocs의 `title`, `lineNumbers`, `[!code highlight]`, `[!code --]`, `[!code ++]` 문법을 그대로 사용한다. 추가 런타임 코드 강조기를 설치하지 않는다.

````mdx
<CodeExample>

```ts title="request-key.ts" lineNumbers
const userId = "reader";
const requestId = "request-1";
const key = userId + ":" + requestId; // [!code highlight]
```

<CodeNotes>
  <CodeNote lines="1–2행">사용자와 요청을 식별합니다.</CodeNote>
  <CodeNote lines="3행">사용자별 요청 키를 만듭니다.</CodeNote>
</CodeNotes>

</CodeExample>
````

`CodeExample`은 코드와 설명을 묶고 강조·diff 줄의 대비를 보완한다. 비교 패널과 예상 결과 안의 코드에도 같은 보정을 적용한다. 기존 일반 코드 블록 스타일은 그대로 유지한다.

`lines`는 독자가 읽는 설명이므로 글의 언어로 작성한다. 코드 수정 시 설명의 줄 범위도 함께 갱신한다. diff는 색상뿐 아니라 기존 Shiki의 `+`/`−` 표시를 함께 제공한다.

## 비교·예제와 반례

`Comparison`의 각 항목에는 Markdown 문단·목록·코드가 들어간다. 두 항목은 넓은 화면에서 나란히, 모바일에서 작성 순서대로 표시된다. 동시에 비교할 내용을 탭 뒤에 숨기지 않는다.

```mdx
<Comparison title="요청 키의 변경">
  <ComparisonItem title="변경 전">
    사용자 식별자만 사용하면 다른 요청도 같은 키를 가집니다.
  </ComparisonItem>
  <ComparisonItem title="변경 후">
    사용자와 요청 식별자를 함께 사용합니다.
  </ComparisonItem>
</Comparison>
```

예제·반례도 같은 컴포넌트에서 제목을 `예제: 같은 요청 재전송`, `반례: 매번 새 식별자 생성`처럼 구체적으로 쓴다. 두 항목은 같은 입력·조건을 기준으로 비교하고, 실패 이유를 텍스트로 설명한다. 세 가지 이상 대안을 비교할 때는 기존 Markdown 표나 `ComparisonTable`이 적합하다.

## 예상 결과와 확인 방법

````mdx
<ExpectedResult title="예상 결과와 확인 방법">

```text title="예상 요청 키"
reader:request-1
```

1. 같은 요청에서 같은 키가 나오는지 확인합니다.
2. 다른 요청에서는 다른 키가 나오는지 확인합니다.

</ExpectedResult>
````

예상 결과는 실제 검사가 통과했다는 상태 표시가 아니다. 작성자가 기대하는 출력과 독자가 실행할 확인 절차를 함께 둔다. `Steps`/`Step` 안에서도 사용할 수 있다. 본문은 정적 목록으로 제공하며 불필요한 대화형 체크박스를 추가하지 않는다.

`KeyPoints`, `ComparisonTable`, `ArticleFigure`도 Blog·Docs·Invest에서 공통으로 사용할 수 있다. 모든 글에 요약·비교를 강제하지 않는다.

공개 미리보기와 복사 가능한 MDX: [한국어 Showcase](/ko/showcase#mdx), [English Showcase](/en/showcase#mdx).

- [형광펜](/ko/showcase#mdx-highlight) · [알림](/ko/showcase#mdx-alerts)
- [접기](/ko/showcase#mdx-details) · [용어 정의](/ko/showcase#mdx-glossary)
- [코드와 설명](/ko/showcase#mdx-code) · [변경 비교](/ko/showcase#mdx-comparison)
- [예제와 반례](/ko/showcase#mdx-examples) · [예상 결과](/ko/showcase#mdx-expected-result)

기능별 원본은 `fixtures/reading/{ko,en}/*.mdx`에 둡니다. 미리보기와 복사 원문은 같은 파일을 빌드해 제공하며 frontmatter만 복사에서 제외합니다. 예제는 검색·RSS·사이트맵에 별도 문서로 등록하지 않습니다. 테스트 전용 `/fixtures/reading-*`는 `PLAYWRIGHT_TEST=1`에서만 노출됩니다.
