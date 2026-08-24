import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopApi } from "../shared/contracts/desktop-api";
import {
  openExternalUrl,
  selectPatchExportPath,
  selectPatchImportPath,
} from "./electronActions";

function installElectronApi(api: Partial<DesktopApi>): void {
  vi.stubGlobal("window", { gitClient: api });
}

describe("전자 동작", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("[성공] 패치를 가져오고 가져오기 위해 Electron 대화 상자를 사용함", async () => {
    const saveFile = vi.fn(async () => "/tmp/export.patch");
    const openFile = vi.fn(async () => "/tmp/import.patch");
    installElectronApi({
      dialog: {
        openDirectory: vi.fn(),
        openFile,
        saveFile,
      },
    });

    await expect(selectPatchExportPath("deadbeef.patch")).resolves.toBe(
      "/tmp/export.patch",
    );
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

  it("[성공] Electron을 통해 자격 증명이 없는 HTTP(S) URL만 조사함", async () => {
    const openExternal = vi.fn(async () => undefined);
    installElectronApi({ shell: { openExternal } });

    await expect(
      openExternalUrl("https://github.com/owner/repository/commit/abc"),
    ).resolves.toBeUndefined();
    await expect(
      openExternalUrl(
        "http://gitlab.example.test/group/project/-/merge_requests/1",
      ),
    ).resolves.toBeUndefined();
    await expect(openExternalUrl("file:///tmp/secret")).rejects.toThrow(
      "credential-free HTTP or HTTPS",
    );
    await expect(
      openExternalUrl("https://token@example.test/private"),
    ).rejects.toThrow("credential-free HTTP or HTTPS");
    expect(openExternal).toHaveBeenCalledTimes(2);
  });

  it("[성공] 기본 경계에서 Electron 커밋 Sign과 패치 작업을 유지함", async () => {
    const vcsSource = await readFile(
      fileURLToPath(
        new URL(
          "../features/repository/vcs/useRepositoryVcsController.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const reviewSource = await readFile(
      fileURLToPath(
        new URL(
          "../features/repository/review/useRepositoryReviewController.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    expect(reviewSource).toContain(
      "if (!primaryCommitOid || !isElectronRuntime())",
    );
    expect(reviewSource).toContain("selectPatchExportPath(");
    expect(vcsSource).toContain("selectPatchImportPath()");
    expect(reviewSource).toContain("openExternalUrl(url)");
  });
});
