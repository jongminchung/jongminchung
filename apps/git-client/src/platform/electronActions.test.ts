import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopApi } from "../shared/contracts/ipc";
import { openExternalUrl, selectPatchExportPath, selectPatchImportPath } from "./electronActions";

function installElectronApi(api: Partial<DesktopApi>): void {
  vi.stubGlobal("window", { gitClient: api });
}

describe("native Electron actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the typed Electron dialogs for patch import and export", async () => {
    const saveFile = vi.fn(async () => "/tmp/export.patch");
    const openFile = vi.fn(async () => "/tmp/import.patch");
    installElectronApi({
      dialog: {
        openDirectory: vi.fn(),
        openFile,
        saveFile,
      },
    });

    await expect(selectPatchExportPath("deadbeef.patch")).resolves.toBe("/tmp/export.patch");
    await expect(selectPatchImportPath()).resolves.toBe("/tmp/import.patch");
    expect(saveFile).toHaveBeenCalledWith({
      title: "Export Git patch",
      defaultPath: "deadbeef.patch",
      filters: [{ name: "Git patch", extensions: ["patch", "mbox"] }],
    });
    expect(openFile).toHaveBeenCalledWith({
      title: "Import Git patch",
      defaultPath: null,
      filters: [
        {
          name: "Git patch",
          extensions: ["patch", "diff", "mbox"],
        },
      ],
    });
  });

  it("opens only credential-free HTTP(S) URLs through Electron", async () => {
    const openExternal = vi.fn(async () => undefined);
    installElectronApi({ shell: { openExternal } });

    await expect(
      openExternalUrl("https://github.com/owner/repository/commit/abc"),
    ).resolves.toBeUndefined();
    await expect(
      openExternalUrl("http://gitlab.example.test/group/project/-/merge_requests/1"),
    ).resolves.toBeUndefined();
    await expect(openExternalUrl("file:///tmp/secret")).rejects.toThrow(
      "credential-free HTTP or HTTPS",
    );
    await expect(openExternalUrl("https://token@example.test/private")).rejects.toThrow(
      "credential-free HTTP or HTTPS",
    );
    expect(openExternal).toHaveBeenCalledTimes(2);
  });

  it("keeps Electron commit signatures and patch actions on native boundaries", async () => {
    const appSource = await readFile(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");

    expect(appSource).toContain("if (!primaryCommitOid || !isElectronRuntime())");
    expect(appSource).toContain("selectPatchExportPath(");
    expect(appSource).toContain("selectPatchImportPath()");
    expect(appSource).toContain("openExternalUrl(url)");
  });
});
