import { parseExcalidrawAssetSrc } from "#lib/tech/excalidraw-scene";

interface ExcalidrawAssetDiagramProps {
  readonly ariaLabel?: string;
  readonly caption?: string;
  readonly src: string;
}

const preparedAssetIds = {
  "rke2-gitops-ownership": "8c58cb29",
  "rke2spray-kubespray-execution-models": "a8372cba",
} as const satisfies Readonly<Record<string, string>>;

export function preparedExcalidrawAssetId(src: string): string {
  const { slug } = parseExcalidrawAssetSrc(src);
  const id = preparedAssetIds[slug as keyof typeof preparedAssetIds];
  if (id === undefined)
    throw new Error(`Excalidraw asset is not registered for MDX: ${src}`);
  return id;
}

/** 빌드에서 생성된 standalone Excalidraw SVG를 MDX에 light·dark 쌍으로 렌더링함 */
export function ExcalidrawAssetDiagram({
  ariaLabel,
  caption,
  src,
}: ExcalidrawAssetDiagramProps): React.JSX.Element {
  const asset = parseExcalidrawAssetSrc(src);
  const id = preparedExcalidrawAssetId(src);
  return (
    <figure
      aria-label={ariaLabel ?? asset.filename}
      className="flex min-h-[clamp(320px,52vw,520px)] min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border bg-card"
      data-excalidraw-asset={asset.slug}
      data-excalidraw-state="ready"
    >
      <div className="flex min-h-11 items-center justify-end border-b bg-card px-2.5 py-1.5">
        <a
          className="inline-flex min-h-[30px] items-center rounded-[var(--radius-sm)] border px-2.5 py-[5px] text-xs leading-[1.2] no-underline hover:border-input"
          download
          href={asset.src}
        >
          Download source
        </a>
      </div>
      <div className="relative min-h-0 flex-1 bg-card">
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain dark:hidden"
          src={`/excalidraw-assets/diagrams/${id}.light.svg`}
        />
        <img
          alt=""
          aria-hidden="true"
          className="hidden h-full w-full object-contain dark:block"
          src={`/excalidraw-assets/diagrams/${id}.dark.svg`}
        />
      </div>
      {caption === undefined ? null : (
        <figcaption className="border-t px-3 py-2.5 text-xs leading-[1.4] text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
