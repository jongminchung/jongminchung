import { defineI18n } from "fumadocs-core/i18n";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { investmentCollection, techCollection } from "../.source/server.ts";

export const contentI18n = defineI18n({
  languages: ["ko", "en"],
  defaultLanguage: "en",
  parser: "dir",
  fallbackLanguage: null,
});

export const techSource = loader({
  baseUrl: "/",
  source: toFumadocsSource(techCollection, []),
  i18n: contentI18n,
  url: (slugs, locale) => `/${locale ?? "en"}/${slugs.at(-1) ?? ""}`,
});

export const investmentSource = loader({
  baseUrl: "/",
  source: toFumadocsSource(investmentCollection, []),
  i18n: contentI18n,
  url: (slugs, locale) => `/${locale ?? "en"}/notes/${slugs.at(-1) ?? ""}`,
});
