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
    <ul className="m-0 grid list-none gap-0.5 p-0 [&_a]:block [&_a]:py-1 [&_a]:text-[11px] [&_a]:leading-[1.35] [&_a]:text-muted-foreground [&_a:hover]:text-foreground [&_a[data-active=true]]:font-medium [&_a[data-active=true]]:text-foreground [&_li[data-level='3']_a]:pl-3">
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
  const outlineItems = items.filter(({ depth }) => depth <= 3);

  return (
    <AnchorProvider toc={outlineItems} single>
      <div className="grid gap-2.5 py-3" aria-label={t("onThisPage")}>
        <p className="mb-1 font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">
          {t("onThisPage")}
        </p>
        <nav aria-label={t("documentOutline")}>
          <OutlineItems items={outlineItems} />
        </nav>
        <BackToTopButton />
      </div>
    </AnchorProvider>
  );
}
