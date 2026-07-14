import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jamie.kr"),
  title: "Jamie — Jongmin Chung",
  description:
    "Jongmin Chung builds software that turns shared language into clear models, public APIs, and verifiable change.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Jamie — Jongmin Chung",
    description: "Complex systems should explain themselves.",
    url: "/",
    siteName: "jamie.kr",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jamie — Jongmin Chung",
    description: "Complex systems should explain themselves.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
