import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialInfiniteResults } from "./EditorialInfiniteResults";

describe("EditorialInfiniteResults", () => {
  it("renders a navigable next page when client automation is unavailable", () => {
    const markup = renderToStaticMarkup(
      <EditorialInfiniteResults
        className="results"
        endLabel="All articles loaded"
        initialNextPageHref="/en?sort=oldest&page=2"
        initialPage={1}
        loadMoreLabel="Load more"
        pageSize={2}
        view="list"
      >
        <a href="/one">One</a>
        <a href="/two">Two</a>
        <a href="/three">Three</a>
      </EditorialInfiniteResults>,
    );

    expect(markup).toContain('href="/en?sort=oldest&amp;page=2"');
    expect(markup).toContain("Load more");
    expect(markup).not.toContain('href="/three"');
  });

  it("renders the completion status when every result is visible", () => {
    const markup = renderToStaticMarkup(
      <EditorialInfiniteResults
        className="results"
        endLabel="All articles loaded"
        initialNextPageHref="/en?page=2"
        initialPage={1}
        loadMoreLabel="Load more"
        pageSize={2}
        view="grid"
      >
        <a href="/one">One</a>
        <a href="/two">Two</a>
      </EditorialInfiniteResults>,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("All articles loaded");
    expect(markup).not.toContain("Load more");
  });
});
