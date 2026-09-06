import { afterAll, describe, expect, it, mock } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import type { EditorialCopy, EditorialItem } from "#lib/editorial";
import type { EditorialCardProps } from "./EditorialCard";

await mock.module("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const { EditorialIndex } = await import("./EditorialIndex");

afterAll(() => mock.restore());

const copy = {
  eyebrow: "Notes",
  title: "Editorial",
  description: "Editorial description",
  all: "All articles",
  newest: "Newest",
  oldest: "Oldest",
  grid: "Grid",
  list: "List",
  loadMore: "Load more",
  empty: "No articles",
  related: "Related",
  controls: "Article list controls",
  browseTags: (count) => `Browse tags · ${count}`,
  previousPage: "Previous page",
  nextPage: "Next page",
  pagination: "Pagination",
  pageLabel: (page, total) => `Page ${page} of ${total}`,
} satisfies EditorialCopy;

const items = Array.from({ length: 10 }, (_, index) => ({
  id: `article-${index}`,
  href: `/en/article-${index}`,
  title: `Article ${index}`,
  description: `Description ${index}`,
  publishedAt: `2026-09-${String(index + 1).padStart(2, "0")}`,
  tags: [`tag-${index}`],
  kind: "Article",
  mediaSeed: `article-${index}`,
})) satisfies readonly EditorialItem[];

function TestCard({ item }: EditorialCardProps): React.JSX.Element {
  return <a href={item.href}>{item.title}</a>;
}

describe("EditorialIndex tag browser", () => {
  it("shows the remaining count and every deferred tag in a native details panel", () => {
    const markup = renderToStaticMarkup(
      <EditorialIndex
        Card={TestCard}
        copy={copy}
        expandedTagClassName="expanded-contract"
        items={items}
        pagination="links"
        pathname="/en"
        query={{ tag: undefined, sort: "newest", view: "grid", page: 1 }}
        quickTagClassName="quick-contract"
        tagBrowserClassName="browser-contract"
      />,
    );
    const document = new Window().document;
    document.body.innerHTML = markup;

    const browser = document.querySelector(
      '[data-editorial-tag-browser="true"]',
    );
    const panel = document.querySelector('[data-editorial-tag-panel="true"]');
    expect(browser?.hasAttribute("open")).toBe(false);
    expect(browser?.textContent).toContain("Browse tags · 3");
    expect(browser?.classList.contains("browser-contract")).toBe(true);
    expect(
      browser?.querySelector('[data-editorial-tag-chevron="true"]'),
    ).not.toBeNull();
    expect(panel?.querySelectorAll("a")).toHaveLength(3);
    expect(panel?.querySelectorAll("a.expanded-contract")).toHaveLength(3);
    expect(panel?.querySelector("a")?.children).toHaveLength(2);
    expect(
      document.querySelectorAll(
        '[data-editorial-quick-tags="true"] a.quick-contract',
      ),
    ).toHaveLength(8);
  });

  it("keeps a selected deferred tag in the quick filters while the panel stays collapsed", () => {
    const markup = renderToStaticMarkup(
      <EditorialIndex
        Card={TestCard}
        copy={copy}
        items={items}
        pagination="links"
        pathname="/en"
        query={{ tag: "tag-9", sort: "newest", view: "grid", page: 1 }}
      />,
    );
    const document = new Window().document;
    document.body.innerHTML = markup;

    const selectedTag = document.querySelector(
      '[data-editorial-quick-tags="true"] a[aria-current="page"]',
    );
    const browser = document.querySelector(
      '[data-editorial-tag-browser="true"]',
    );
    expect(selectedTag?.textContent).toContain("tag-9");
    expect(browser?.hasAttribute("open")).toBe(false);
    expect(browser?.textContent).toContain("Browse tags · 2");
    expect(browser?.querySelector('a[href*="tag=tag-9"]')).toBeNull();
  });
});
