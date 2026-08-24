import type { Metadata } from "next";
import { themeScript } from "#lib/theme";
import { pretendard } from "./fonts";

export { pretendard };

export const rootMetadata: Metadata = {
  metadataBase: new URL("https://tech.jamie.kr"),
  title: {
    default: "Engineering Notes",
    template: "%s · Engineering Notes",
  },
  description:
    "Bilingual engineering articles organized as Handbook and Deep Dive series.",
};

/** `InitialThemeScript` 초기 렌더링 전에 사이트 색상 모드를 적용함 */
export function InitialThemeScript({
  storageKey,
}: {
  readonly storageKey: string;
}): React.JSX.Element {
  return (
    <script dangerouslySetInnerHTML={{ __html: themeScript(storageKey) }} />
  );
}

/** `InitialTechDocumentScripts` Tech 전용 초기 자산 경로를 설정함 */
export function InitialTechDocumentScripts(): React.JSX.Element {
  return <InitialThemeScript storageKey="tech-theme" />;
}
