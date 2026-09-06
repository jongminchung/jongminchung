import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Details,
  Summary,
  Glossary,
  Term,
  Definition,
  Comparison,
  ComparisonItem,
  ExpectedResult,
  CodeNotes,
  CodeNote,
} from "./ReadingBlocks";

describe("MDX 읽기 블록", () => {
  test("native 펼침 상태·용어 anchor·재정의 class를 보존함", () => {
    const html = renderToStaticMarkup(
      <Details open className="my-2">
        <Summary>설명</Summary>
        <Glossary>
          <Term id="term">용어</Term>
          <Definition>정의</Definition>
        </Glossary>
      </Details>,
    );
    expect(html).toContain("<details open=");
    expect(html).toContain("<summary");
    expect(html).toContain('id="term"');
    expect(html).toContain("<dl");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
    expect(html).toContain("my-2");
    expect(html).not.toContain("my-6 min-w-0 rounded-lg");
  });
  test("비교 제목·항목 순서·코드 줄의 텍스트 설명을 유지함", () => {
    const html = renderToStaticMarkup(
      <Comparison title="비교">
        <ComparisonItem title="변경 전">이전</ComparisonItem>
        <ComparisonItem title="변경 후">
          <CodeNotes>
            <CodeNote lines="3행">이유</CodeNote>
          </CodeNotes>
        </ComparisonItem>
      </Comparison>,
    );
    expect(html).toContain("<figcaption");
    expect(html).toContain('aria-label="변경 전"');
    expect(html.indexOf("이전")).toBeLessThan(html.indexOf("이유"));
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
    expect(html).toContain("3행");
  });
  test("예상 결과는 실제 작업 성공을 알리는 live region이 아님", () => {
    const html = renderToStaticMarkup(
      <ExpectedResult title="확인 방법">
        <p>응답 상태를 확인하세요.</p>
      </ExpectedResult>,
    );
    expect(html).toContain('aria-label="확인 방법"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("aria-live");
  });
});
