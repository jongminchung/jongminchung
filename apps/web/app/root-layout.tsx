import type { Metadata } from "next";
import { siteOrigins } from "#lib/site-routing";
import {
  localeFontClassName,
  pretendard,
  pretendardStylesheetHref,
} from "./fonts";

export { localeFontClassName, pretendard, pretendardStylesheetHref };

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteOrigins.tech),
  title: {
    default: "Engineering Notes",
    template: "%s · Engineering Notes",
  },
  description:
    "Bilingual engineering articles organized as Handbook and Deep Dive series.",
};
