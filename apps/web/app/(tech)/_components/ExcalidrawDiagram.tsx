import {
  excalidrawSvgSrc,
  parseExcalidrawSource,
} from "#lib/tech/excalidraw-scene";

interface ExcalidrawDiagramBaseProps {
  readonly ariaLabel?: string;
  readonly caption?: string;
  readonly downloadSrc?: string;
  readonly variant?: "embedded" | "standalone";
}

export interface ExcalidrawDiagramProps extends ExcalidrawDiagramBaseProps {
  readonly source: string;
}

/** 정적 SVG 기반 Excalidraw 다이어그램을 렌더링함 */
export function ExcalidrawDiagram(
  props: ExcalidrawDiagramProps,
): React.JSX.Element {
  const scene = parseExcalidrawSource(props.source, "inline scene");
  const variant = props.variant ?? "embedded";
  const ariaLabel = props.ariaLabel ?? "Excalidraw diagram";
  const lightSrc = excalidrawSvgSrc(props.source, "light");
  const darkSrc = excalidrawSvgSrc(props.source, "dark");
  return (
    <figure
      aria-label={ariaLabel}
      className={
        variant === "standalone"
          ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card"
          : "flex min-h-[clamp(320px,52vw,520px)] min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border bg-card"
      }
      data-excalidraw-state="ready"
      data-rendered-element-count={scene.elementCount}
      data-rendered-text-content={JSON.stringify(scene.textContent)}
      data-source-element-count={scene.elementCount}
    >
      {props.downloadSrc === undefined ? null : (
        <div className="flex min-h-11 items-center justify-end border-b bg-card px-2.5 py-1.5">
          <a
            className="inline-flex min-h-[30px] items-center rounded-[var(--radius-sm)] border px-2.5 py-[5px] text-xs leading-[1.2] no-underline hover:border-input"
            download
            href={props.downloadSrc}
          >
            Download source
          </a>
        </div>
      )}
      <div className="relative min-h-0 flex-1 bg-card">
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain dark:hidden"
          src={lightSrc}
        />
        <img
          alt=""
          aria-hidden="true"
          className="hidden h-full w-full object-contain dark:block"
          src={darkSrc}
        />
        {scene.textContent.length === 0 ? null : (
          <span className="sr-only" data-excalidraw-text="true">
            {scene.textContent.join(" · ")}
          </span>
        )}
      </div>
      {props.caption === undefined ? null : (
        <figcaption className="border-t px-3 py-2.5 text-xs leading-[1.4] text-muted-foreground">
          {props.caption}
        </figcaption>
      )}
    </figure>
  );
}
