"use client";

import {
  AnchorProvider,
  TOCItem,
  type TOCItemType,
  useActiveAnchor,
} from "fumadocs-core/toc";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { BackToTopButton } from "./BackToTopButton";

function subscribeToHashChange(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashId(): string | null {
  return window.location.hash.slice(1) || null;
}

function OutlineItems({ items }: { readonly items: readonly TOCItemType[] }) {
  const activeId = useActiveAnchor();
  const selectedId = useSyncExternalStore(
    subscribeToHashChange,
    getHashId,
    () => null,
  );
  const currentId = selectedId ?? activeId;

  return (
    <ul className="relative m-0 ml-3 grid list-none gap-3 border-l-2 border-border p-0 [&_a]:-ml-0.5 [&_a]:block [&_a]:border-l-2 [&_a]:border-transparent [&_a]:py-0 [&_a]:pl-4 [&_a]:text-sm [&_a]:leading-5 [&_a]:text-muted-foreground [&_a]:transition-colors [&_a:hover]:text-foreground [&_a[data-active=true]]:border-primary [&_a[data-active=true]]:font-medium [&_a[data-active=true]]:text-foreground">
      {items.map((item) => {
        const id = item.url.replace(/^#/u, "");
        return (
          <li key={item.url} data-level={item.depth}>
            <TOCItem
              aria-current={currentId === id ? "location" : undefined}
              href={item.url}
            >
              {item.title}
            </TOCItem>
          </li>
        );
      })}
    </ul>
  );
}

/** `DocumentOutline` UI 컴포넌트를 렌더링함 */
export function DocumentOutline({
  items,
}: {
  readonly items: readonly TOCItemType[];
}): React.JSX.Element {
  const t = useTranslations("tech.outline");
  const outlineItems = items.filter(({ depth }) => depth === 2);

  return (
    <AnchorProvider toc={outlineItems} single>
      <div className="grid gap-5 py-3" aria-label={t("onThisPage")}>
        <p className="sr-only">{t("onThisPage")}</p>
        <nav aria-label={t("documentOutline")}>
          <OutlineItems items={outlineItems} />
        </nav>
        <BackToTopButton label={t("backToTop")} />
      </div>
    </AnchorProvider>
  );
}
