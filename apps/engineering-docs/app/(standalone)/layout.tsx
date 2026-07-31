import type { Metadata } from "next";
import type { ReactNode } from "react";
import { InitialDocumentScripts, rootFontClassName, rootMetadata } from "../root-layout";

export const metadata: Metadata = rootMetadata;

export default function StandaloneLayout({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <html className={rootFontClassName} lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <InitialDocumentScripts />
      </head>
      <body>{children}</body>
    </html>
  );
}
