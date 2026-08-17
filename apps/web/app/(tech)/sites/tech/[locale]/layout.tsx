import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TechDataProvider } from "#components/TechDataProvider";
import { isLocale } from "#lib/content-model";
import {
    InitialDocumentScripts,
    rootFontClassName,
    rootMetadata,
} from "../../../../root-layout";
import "../../../tech.css";

export const metadata: Metadata = rootMetadata;

export default async function LocaleLayout({
    children,
    params,
}: {
    readonly children: ReactNode;
    readonly params: Promise<{ readonly locale: string }>;
}): Promise<React.JSX.Element> {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
        <html
            className={rootFontClassName}
            lang={locale}
            data-theme="light"
            suppressHydrationWarning
        >
            <head>
                <InitialDocumentScripts />
            </head>
            <body data-site="tech">
                <TechDataProvider>{children}</TechDataProvider>
            </body>
        </html>
    );
}
