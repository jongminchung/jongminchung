import type { Metadata } from "next";
import { DM_Mono, Inter, Inter_Tight } from "next/font/google";

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
    metadataBase: new URL("https://tech.jamie.kr"),
    title: {
        default: "Engineering Notes",
        template: "%s · Engineering Notes",
    },
    description:
        "Bilingual engineering articles organized as Handbook and Deep Dive series.",
};

const themeScript = `(()=>{try{const m=localStorage.getItem("tech-theme")||"system";const d=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch{}})()`;
const excalidrawAssetScript = `window.EXCALIDRAW_ASSET_PATH="/excalidraw-assets/"`;

export const rootFontClassName = `${inter.variable} ${interTight.variable} ${dmMono.variable}`;

/** `InitialDocumentScripts` 공개 기능을 제공함 */
export function InitialDocumentScripts(): React.JSX.Element {
    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            <script
                dangerouslySetInnerHTML={{ __html: excalidrawAssetScript }}
            />
        </>
    );
}
