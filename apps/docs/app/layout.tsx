import type { Metadata } from "next";
import { DM_Mono, Inter, Inter_Tight } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "@/generated/docs-theme.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://jongminchung.dev"),
  title: {
    default: "Jongmin Chung Docs",
    template: "%s · Jongmin Chung Docs",
  },
  description: "Official handbooks, package references, and platform deep dives.",
};

const themeScript = `(()=>{try{const m=localStorage.getItem("docs-theme")||"system";const d=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch{}})()`;

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${interTight.variable} ${dmMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
