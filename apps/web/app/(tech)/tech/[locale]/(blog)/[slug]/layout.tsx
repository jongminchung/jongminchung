import type { ReactNode } from "react";
import "../../../../tech-document.css";

/** Blog 본문에서만 코드블록과 typography 스타일을 로드함 */
export default function BlogArticleLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return children;
}
