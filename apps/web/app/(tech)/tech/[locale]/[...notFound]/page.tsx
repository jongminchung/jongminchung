import { notFound } from "next/navigation";
import { locales } from "#lib/site-routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale, notFound: ["404"] }));
}

/** locale prefix를 가진 알려지지 않은 다중 segment URL을 현지화된 404로 연결함 */
export default function TechNotFoundPage(): never {
  notFound();
}
