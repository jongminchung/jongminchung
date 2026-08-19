import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "#lib/content-model";
import { TechDataProvider } from "#tech-components/TechDataProvider";
import {
    InitialTechDocumentScripts,
    pretendard,
    rootMetadata,
} from "../../../root-layout";
import "../../tech.css";

export const metadata: Metadata = rootMetadata;

/** `LocaleLayout` 페이지 UI를 렌더링함 */
export default async function LocaleLayout({
    children,
    params,
}: LayoutProps<"/tech/[locale]">): Promise<React.JSX.Element> {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
        <html
            lang={locale}
            className={pretendard.variable}
            data-theme="light"
            suppressHydrationWarning
        >
            <head>
                <InitialTechDocumentScripts />
            </head>
            <body data-site="tech">
                <TechDataProvider>{children}</TechDataProvider>
            </body>
        </html>
    );
}
