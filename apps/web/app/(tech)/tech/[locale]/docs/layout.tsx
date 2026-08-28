import type { ReactNode } from "react";

/** Docs root와 영역 페이지가 각자 필요한 탐색 셸을 선택하도록 자식을 전달함 */
export default function TechDocsLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return children;
}
