import { readFile } from "node:fs/promises";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findStandaloneExcalidrawAsset,
  listStandaloneExcalidrawAssets,
} from "#lib/tech/excalidraw-files";
import { ExcalidrawDiagram } from "#tech-components/ExcalidrawDiagram";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams(): Promise<
  { readonly slug: string }[]
> {
  const assets = await listStandaloneExcalidrawAssets();
  return assets.map((asset) => ({ slug: asset.slug }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/tech/diagrams/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const asset = await findStandaloneExcalidrawAsset(slug);
  if (asset === null) return {};
  return {
    title: { absolute: asset.filename },
    alternates: { canonical: `/diagrams/${asset.slug}` },
  };
}

/** `StandaloneExcalidrawPage` 페이지 UI를 렌더링함 */
export default async function StandaloneExcalidrawPage({
  params,
}: PageProps<"/tech/diagrams/[slug]">): Promise<React.JSX.Element> {
  const { slug } = await params;
  const asset = await findStandaloneExcalidrawAsset(slug);
  if (asset === null) notFound();
  const source = await readFile(asset.filePath, "utf8");

  return (
    <main className="flex h-dvh min-h-[480px] w-full flex-col overflow-hidden bg-background">
      <header className="flex min-h-[52px] items-center gap-3 border-b bg-card px-4 py-2">
        <Link
          aria-label="All diagrams"
          className="shrink-0 border-r pr-3 text-xs text-muted-foreground hover:text-foreground"
          href="/diagrams"
        >
          Diagrams
        </Link>
        <h1 className="m-0 min-w-0 overflow-hidden font-mono text-sm font-medium text-ellipsis whitespace-nowrap">
          {asset.filename}
        </h1>
      </header>
      <div className="flex min-h-0 flex-1">
        <ExcalidrawDiagram
          ariaLabel={asset.filename}
          downloadSrc={asset.src}
          source={source}
          variant="standalone"
        />
      </div>
    </main>
  );
}
