import { defineI18n } from "fumadocs-core/i18n";

export const contentI18n = defineI18n({
  languages: ["ko", "en"],
  defaultLanguage: "en",
  parser: "dir",
  fallbackLanguage: null,
});
