import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TechDataProvider } from "#components/TechDataProvider";
import {
    InitialTechDocumentScripts,
    pretendard,
    rootMetadata,
} from "../../../../root-layout";
import "../../../tech.css";

export const metadata: Metadata = rootMetadata;

/** `DiagramRootLayout` 페이지 UI를 렌더링함 */
export default function DiagramRootLayout({
    children,
}: {
    readonly children: ReactNode;
}): React.JSX.Element {
    return (
        <html
            lang="en"
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
