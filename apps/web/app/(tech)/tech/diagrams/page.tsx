import type { Metadata } from "next";
import Link from "next/link";
import { listStandaloneExcalidrawAssets } from "#lib/tech/excalidraw-files";

export const metadata: Metadata = {
  title: { absolute: "Diagrams" },
  alternates: { canonical: "/diagrams" },
};

/** `DiagramsPage` 페이지 UI를 렌더링함 */
export default async function DiagramsPage(): Promise<React.JSX.Element> {
  const assets = await listStandaloneExcalidrawAssets();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[880px] bg-background px-[clamp(20px,5vw,48px)] pt-[clamp(48px,8vw,96px)] pb-[clamp(48px,8vw,96px)]">
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs tracking-[.08em] text-muted-foreground uppercase">
          Excalidraw
        </p>
        <h1 className="m-0 text-[clamp(32px,6vw,52px)] leading-none font-semibold tracking-[-.04em]">
          Diagrams
        </h1>
      </header>

      {assets.length === 0 ? (
        <p className="m-0 text-muted-foreground">No diagrams available.</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {assets.map((asset) => (
            <li
              className="flex min-w-0 items-center justify-between gap-5 rounded-[var(--radius-md)] border bg-card p-5 max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-3"
              key={asset.filename}
            >
              <Link
                className="min-w-0 overflow-hidden font-mono text-sm font-medium text-ellipsis whitespace-nowrap hover:underline [text-underline-offset:4px]"
                href={`/diagrams/${asset.slug}`}
              >
                {asset.filename}
              </Link>
              <a
                aria-label={`Download ${asset.filename}`}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                download
                href={asset.src}
              >
                Download source
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
