"use client";

import {
  AnchorProvider,
  TOCItem,
  type TOCItemType,
  useActiveAnchor,
} from "fumadocs-core/toc";
import { BackToTopButton } from "./BackToTopButton";

function OutlineItems({ items }: { readonly items: readonly TOCItemType[] }) {
  const activeId = useActiveAnchor();

  return (
    <ul className="relative m-0 grid list-none gap-1 p-0">
      {items.map((item) => {
        const id = item.url.replace(/^#/u, "");
        return (
          <li key={item.url} data-level={item.depth}>
            <TOCItem
              className="block rounded-lg px-3 py-1.5 text-sm leading-5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[active=true]:bg-secondary data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:hover:bg-secondary"
              aria-current={activeId === id ? "location" : undefined}
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
  labels,
}: {
  readonly items: readonly TOCItemType[];
  readonly labels: {
    readonly backToTop: string;
    readonly documentOutline: string;
    readonly onThisPage: string;
  };
}): React.JSX.Element {
  const outlineItems = items.filter(({ depth }) => depth === 2);

  return (
    <AnchorProvider toc={outlineItems} single>
      <div className="grid gap-5 py-3" aria-label={labels.onThisPage}>
        <p className="sr-only">{labels.onThisPage}</p>
        <nav aria-label={labels.documentOutline}>
          <OutlineItems items={outlineItems} />
        </nav>
        <BackToTopButton label={labels.backToTop} />
      </div>
    </AnchorProvider>
  );
}
