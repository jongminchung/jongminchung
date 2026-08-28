import type { Metadata } from "next";
import { localeFontClassName, pretendard } from "./fonts";

export { localeFontClassName, pretendard };

export const rootMetadata: Metadata = {
  metadataBase: new URL("https://tech.jamie.kr"),
  title: {
    default: "Engineering Notes",
    template: "%s · Engineering Notes",
  },
  description:
    "Bilingual engineering articles organized as Handbook and Deep Dive series.",
};
