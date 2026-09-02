import Link from "next/link";
import type { Locale } from "#lib/site-routing";

export const notFoundCopy = {
  en: {
    heading: "Document not found",
    description: "The page may have moved, or the address may be incomplete.",
    link: "Return to the overview",
  },
  ko: {
    heading: "문서를 찾을 수 없습니다",
    description: "페이지가 이동했거나 주소가 불완전할 수 있습니다.",
    link: "개요로 돌아가기",
  },
} as const satisfies Record<
  Locale,
  {
    readonly heading: string;
    readonly description: string;
    readonly link: string;
  }
>;

/** `NotFoundPage` 페이지 UI를 렌더링함 */
export function NotFoundPage({
  locale,
}: {
  readonly locale: Locale;
}): React.JSX.Element {
  const text = notFoundCopy[locale];
  return (
    <main className="grid min-h-dvh min-h-screen place-content-center justify-items-start p-8">
      <p className="m-0 [font-family:var(--font-family-code)] text-lg text-muted-foreground">
        404
      </p>
      <h1 className="my-3 [font-family:var(--font-family-heading)] text-[36px] leading-[1.1] font-medium tracking-[-.025em]">
        {text.heading}
      </h1>
      <p className="text-muted-foreground">{text.description}</p>
      <Link className="mt-[18px] text-foreground" href={`/${locale}`}>
        {text.link}
      </Link>
    </main>
  );
}
