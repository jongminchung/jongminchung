import type { Metadata } from "next";
import { DM_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

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

export const rootMetadata: Metadata = {
  metadataBase: new URL("https://jongminchung.dev"),
  title: {
    default: "Jongmin Chung Engineering Docs",
    template: "%s · Jongmin Chung Engineering Docs",
  },
  description: "Official handbooks, package references, and platform deep dives.",
};

const themeScript = `(()=>{try{const m=localStorage.getItem("engineering-docs-theme")||"system";const d=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch{}})()`;
const excalidrawAssetScript = `window.EXCALIDRAW_ASSET_PATH="/excalidraw-assets/"`;

export const rootFontClassName = `${inter.variable} ${interTight.variable} ${dmMono.variable}`;

export function InitialDocumentScripts(): React.JSX.Element {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <script dangerouslySetInnerHTML={{ __html: excalidrawAssetScript }} />
    </>
  );
}
