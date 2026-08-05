import type { ContentManifestEntry, Locale } from "@/lib/content-model";
import { createOgImageHref, displayTitleFor } from "@/lib/content-model";
import { TransitionLink } from "./RouteTransition";
import styles from "./DocumentCard.module.css";

export type DocumentCardVariant = "featured" | "list" | "related";

const sectionLabels = {
  ko: {
    overview: "개요",
    handbook: "핸드북",
    packages: "패키지",
    "deep-dive": "Deep Dive",
  },
  en: {
    overview: "Overview",
    handbook: "Handbook",
    packages: "Packages",
    "deep-dive": "Deep Dive",
  },
} as const;

export function DocumentCard({
  document,
  locale,
  variant,
  label,
  eager = false,
}: {
  readonly document: ContentManifestEntry;
  readonly locale: Locale;
  readonly variant: DocumentCardVariant;
  readonly label?: string;
  readonly eager?: boolean;
}): React.JSX.Element {
  const title = displayTitleFor(document);
  return (
    <TransitionLink
      aria-label={title}
      className={styles.card}
      data-variant={variant}
      href={document.href}
    >
      <img
        alt=""
        aria-hidden="true"
        className={styles.image}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        height={630}
        loading={eager ? "eager" : "lazy"}
        src={createOgImageHref(locale, document.id)}
        width={1200}
      />
      <span className={styles.body}>
        <span className={styles.eyebrow}>
          {label === undefined ? sectionLabels[locale][document.section] : label}
          <span aria-hidden="true">·</span>
          <time dateTime={document.updatedAt}>{document.updatedAt}</time>
          <span aria-hidden="true">·</span>
          {document.status}
        </span>
        <span className={styles.title}>{title}</span>
        <span className={styles.description}>{document.description}</span>
      </span>
    </TransitionLink>
  );
}
