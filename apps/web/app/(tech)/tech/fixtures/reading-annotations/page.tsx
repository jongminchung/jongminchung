import { notFound } from "next/navigation";
import { Highlight, MarkdownAlert } from "#components/ReadingAnnotations";

/** 새 읽기 요소의 테마·줄바꿈·접근성을 production 환경에서 검사함. */
export default function ReadingAnnotationsFixture() {
  if (process.env.PLAYWRIGHT_TEST !== "1") notFound();
  return (
    <main lang="ko" className="mx-auto max-w-3xl px-4 py-12 leading-7">
      <h1 className="mb-8 text-2xl font-semibold">읽기 주석</h1>
      <p>
        <Highlight>
          긴 한국어 핵심 문장이 여러 줄로 이어져도 각 줄의 형광펜 강조와 읽기
          흐름을 유지합니다. 핵심 내용은 색상 없이도 문장만으로 이해할 수 있어야
          합니다.
        </Highlight>
      </p>
      {(["note", "tip", "important", "warning", "caution"] as const).map(
        (kind) => (
          <MarkdownAlert key={kind} kind={kind} title={kind}>
            <p>
              본문 설명과{" "}
              <a href="#details" className="underline">
                자세한 내용
              </a>
              을 함께 제공합니다.
            </p>
            <p>
              https://example.com/very-long-unbroken-url-for-testing-reading-annotations-without-horizontal-page-overflow
            </p>
          </MarkdownAlert>
        ),
      )}
      <h2 id="details">자세한 내용</h2>
    </main>
  );
}
