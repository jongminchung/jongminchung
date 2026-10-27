import { describe, expect, it } from "vite-plus/test";
import {
  findStandaloneExcalidrawAsset,
  listStandaloneExcalidrawAssets,
} from "./excalidraw-files.ts";

describe("standalone Excalidraw assets", () => {
  it("공개 diagram을 정렬하고 slug로 조회함", async () => {
    const assets = await listStandaloneExcalidrawAssets();
    const filenames = assets.map(({ filename }) => filename);
    expect(filenames).toContain("operating-system.excalidraw");
    expect(filenames).toEqual(
      [...filenames].sort((a, b) => a.localeCompare(b)),
    );
    expect(Object.isFrozen(assets)).toBe(true);
    expect(
      await findStandaloneExcalidrawAsset("operating-system"),
    ).toMatchObject({
      filename: "operating-system.excalidraw",
      src: "/diagrams/operating-system.excalidraw",
    });
    expect(await findStandaloneExcalidrawAsset("missing-diagram")).toBeNull();
  });
});
