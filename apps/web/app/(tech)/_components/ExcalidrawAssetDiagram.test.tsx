import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { excalidrawSceneId } from "#lib/tech/excalidraw-scene";
import {
  ExcalidrawAssetDiagram,
  preparedExcalidrawAssetId,
} from "./ExcalidrawAssetDiagram";

const appRoot = process.cwd().endsWith("/apps/web")
  ? process.cwd()
  : resolve(process.cwd(), "apps/web");
const diagramsRoot = resolve(appRoot, "public/diagrams");

describe("MDX standalone Excalidraw asset", () => {
  it.each(["rke2-gitops-ownership", "rke2spray-kubespray-execution-models"])(
    "생성 SVG ID가 %s 원본 hash와 일치함",
    async (slug) => {
      const src = `/diagrams/${slug}.excalidraw`;
      const source = await readFile(
        resolve(diagramsRoot, `${slug}.excalidraw`),
        "utf8",
      );

      expect(preparedExcalidrawAssetId(src)).toBe(excalidrawSceneId(source));
    },
  );

  it("source 다운로드와 light·dark SVG를 함께 렌더링함", () => {
    const html = renderToStaticMarkup(
      <ExcalidrawAssetDiagram
        caption="Ownership boundary"
        src="/diagrams/rke2-gitops-ownership.excalidraw"
      />,
    );

    expect(html).toContain('data-excalidraw-state="ready"');
    expect(html).toContain("8c58cb29.light.svg");
    expect(html).toContain("8c58cb29.dark.svg");
    expect(html).toContain("Download source");
  });
});
