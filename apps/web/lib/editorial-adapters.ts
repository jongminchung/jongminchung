import {
  createTechArticleImageHref,
  displayTitleFor,
  type ContentManifestEntry,
  type Locale,
} from "./content-model";
import type { EditorialItem } from "./editorial";
import type { InvestmentNoteManifestEntry } from "./invest/content";
import { getTechMessages } from "./tech/copy";
import { documentKindLabel } from "./tech/document-kind";
import { getSeries } from "./tech/series";

/** `toTechEditorialItem` 기술 문서를 공통 editorial 항목으로 변환함 */
export function toTechEditorialItem(
  document: ContentManifestEntry,
  locale: Locale,
): EditorialItem {
  return Object.freeze({
    id: document.id,
    href: document.href,
    title: displayTitleFor(document),
    description: document.description,
    publishedAt: document.publishedAt,
    tags:
      document.documentKind === undefined
        ? document.tags
        : [...document.tags, document.documentKind],
    kind:
      document.documentKind !== undefined
        ? documentKindLabel(locale, document.documentKind)
        : document.contentType !== "blog" || document.series === undefined
          ? getTechMessages(locale).article.engineeringArticle
          : (getSeries(document.series, locale)?.title ?? document.series),
    mediaSeed: `${document.id}:${document.tags.join(":")}`,
    ...(document.contentType === "blog"
      ? {
          image: {
            src: createTechArticleImageHref(document.id),
            alt: displayTitleFor(document),
          },
        }
      : {}),
  });
}

/** `toInvestmentEditorialItem` 투자 노트를 공통 editorial 항목으로 변환함 */
export function toInvestmentEditorialItem(
  note: InvestmentNoteManifestEntry,
): EditorialItem {
  return Object.freeze({
    id: note.id,
    href: note.href,
    title: note.title,
    description: note.description,
    publishedAt: note.publishedAt,
    tags: [...new Set([...note.tags, ...note.sources.map(({ kind }) => kind)])],
    kind: note.series ?? "Research note",
    mediaSeed: `${note.id}:${note.tags.join(":")}`,
    image: { src: note.image, alt: note.imageAlt },
  });
}
