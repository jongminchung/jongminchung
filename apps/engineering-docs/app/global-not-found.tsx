import type { Metadata } from "next";
import { headers } from "next/headers";
import type { Locale } from "#lib/content-model";
import { NotFoundContent, notFoundCopy } from "./not-found";
import { InitialDocumentScripts, rootFontClassName } from "./root-layout";

async function getRequestLocale(): Promise<Locale> {
    return (await headers()).get("x-engineering-docs-locale") === "ko"
        ? "ko"
        : "en";
}

export async function generateMetadata(): Promise<Metadata> {
    const text = notFoundCopy[await getRequestLocale()];
    return {
        title: { absolute: text.heading },
        description: text.description,
    };
}

export default async function GlobalNotFound(): Promise<React.JSX.Element> {
    const locale = await getRequestLocale();
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
            <body>
                <NotFoundContent locale={locale} />
            </body>
        </html>
    );
}
