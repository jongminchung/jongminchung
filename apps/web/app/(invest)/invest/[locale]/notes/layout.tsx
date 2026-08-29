import type { ReactNode } from "react";
import "../../../invest-code.css";

/** Invest note route에서만 Fumadocs code-block stylesheet를 활성화함 */
export default function InvestmentNotesLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  return children;
}
