import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialInfiniteResults } from "./EditorialInfiniteResults";

describe("EditorialInfiniteResults", () => {
  it("renders a navigable next page when client automation is unavailable", () => {
    const markup = renderToStaticMarkup(
      <EditorialInfiniteResults
        className="results"
        endLabel="All articles loaded"
        hasMore
        loadMoreLabel="Load more"
        nextPageHref="/en?sort=oldest&page=2"
        view="list"
      >
        <a href="/one">One</a>
        <a href="/two">Two</a>
      </EditorialInfiniteResults>,
    );

    expect(markup).toContain('href="/en?sort=oldest&amp;page=2"');
    expect(markup).toContain("Load more");
  });

  it("renders the completion status when every result is visible", () => {
    const markup = renderToStaticMarkup(
      <EditorialInfiniteResults
        className="results"
        endLabel="All articles loaded"
        hasMore={false}
        loadMoreLabel="Load more"
        nextPageHref="/en?page=2"
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
