import { notFound } from "next/navigation";
import { locales } from "#lib/site-routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale, notFound: ["404"] }));
}

/** `HomeNotFoundPage` 페이지 UI를 렌더링함 */
export default function HomeNotFoundPage(): never {
  notFound();
}
