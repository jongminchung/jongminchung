import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/content-model";

function selectLocale(savedLocale: string | undefined, acceptLanguage: string | null): Locale {
  if (savedLocale !== undefined && isLocale(savedLocale)) return savedLocale;
  return acceptLanguage?.toLocaleLowerCase().startsWith("ko") ? "ko" : "en";
}

export default async function HomePage(): Promise<never> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = selectLocale(
    cookieStore.get("docs-locale")?.value,
    headerStore.get("accept-language"),
  );
  redirect(`/${locale}/overview`);
}
