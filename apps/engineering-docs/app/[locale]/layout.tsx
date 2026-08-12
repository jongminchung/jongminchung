import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale } from "#lib/content-model";
import {
    InitialDocumentScripts,
    rootFontClassName,
    rootMetadata,
} from "../root-layout";

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
            <body>{children}</body>
        </html>
    );
}
