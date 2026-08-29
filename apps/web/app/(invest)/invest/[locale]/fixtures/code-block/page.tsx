import { notFound } from "next/navigation";
import { locales } from "#lib/site-routing";
import { DocsCodeBlock } from "#tech-components/DocsCodeBlock";
import "../../../../invest-code.css";

/** Playwright fixture의 locale별 정적 경로를 반환함 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** Invest CSS에서 Tech 코드블록 계약을 검증하는 Playwright 전용 fixture임 */
export default function InvestmentCodeBlockFixture(): React.JSX.Element {
  if (process.env.PLAYWRIGHT_TEST !== "1") notFound();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[760px] px-4 py-16">
      <h1 className="mb-8 text-3xl font-medium">Investment code block</h1>
      <DocsCodeBlock data-line-numbers title="analysis.ts">
        <code>
          <span className="line">const marginOfSafety = 0.3;</span>
          <span className="line">
            const estimatedValue = cashFlow / discountRate;
          </span>
          <span className="line">
            const entryPrice = estimatedValue * (1 - marginOfSafety);
          </span>
        </code>
      </DocsCodeBlock>
    </main>
  );
}
