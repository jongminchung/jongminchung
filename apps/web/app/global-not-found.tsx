import type { Metadata } from "next";
import { NotFoundPage, notFoundCopy } from "#components/NotFoundPage";
import { InitialDocumentScripts, rootFontClassName } from "./root-layout";
import "./(tech)/tech.css";

export const metadata: Metadata = {
    title: { absolute: notFoundCopy.en.heading },
    description: notFoundCopy.en.description,
};

/** `GlobalNotFound` 공개 기능을 제공함 */
export default function GlobalNotFound(): React.JSX.Element {
    return (
        <html
            className={rootFontClassName}
            lang="en"
            data-theme="light"
            suppressHydrationWarning
        >
            <head>
                <InitialDocumentScripts />
            </head>
            <body>
                <NotFoundPage locale="en" />
            </body>
        </html>
    );
}
