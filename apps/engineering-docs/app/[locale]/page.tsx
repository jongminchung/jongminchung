import { notFound, redirect } from "next/navigation";
import { isLocale, locales } from "#lib/content-model";

interface PageProps {
  readonly params: Promise<{ readonly locale: string }>;
}

export const dynamicParams = false;

export function generateStaticParams(): { readonly locale: string }[] {
  return locales.map((locale) => ({ locale }));
}

export default async function LocalePage({ params }: PageProps): Promise<never> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/overview`);
}
