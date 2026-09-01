import { defineI18n } from "fumadocs-core/i18n";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import {
  blogCollection,
  docsCollection,
  investmentCollection,
} from "../.source/server.ts";

const contentI18n = defineI18n({
  languages: ["ko", "en"],
  defaultLanguage: "en",
  parser: "dir",
  fallbackLanguage: null,
});

export const blogSource = loader({
  baseUrl: "/",
  source: toFumadocsSource(blogCollection, []),
  i18n: contentI18n,
  url: (slugs, locale) => `/${locale ?? "en"}/${slugs.at(-1) ?? ""}`,
});

export const docsSource = loader({
  baseUrl: "/docs",
  source: docsCollection.toFumadocsSource(),
  i18n: contentI18n,
  url: (slugs, locale) =>
    `/${locale ?? "en"}/docs${slugs.length === 0 ? "" : `/${slugs.join("/")}`}`,
});

export const investmentSource = loader({
  baseUrl: "/",
  source: toFumadocsSource(investmentCollection, []),
  i18n: contentI18n,
  url: (slugs, locale) => `/${locale ?? "en"}/notes/${slugs.at(-1) ?? ""}`,
});
