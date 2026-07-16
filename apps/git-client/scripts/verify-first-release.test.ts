import { describe, expect, it } from "vitest";
import {
  findNewerReleaseTags,
  normalizeGitHubRemote,
  parseMountPoint,
  parseVerificationArguments,
} from "./verify-first-release.mjs";

describe("first Git Client release verification", () => {
  it("requires explicit destructive-operation confirmation", () => {
    expect(parseVerificationArguments(["--confirm", "git-client-1.0.0"])).toEqual({
      confirmation: "git-client-1.0.0",
    });
    expect(() => parseVerificationArguments([])).toThrow("--confirm git-client-1.0.0");
  });

  it("accepts common GitHub origin URL forms", () => {
    expect(normalizeGitHubRemote("git@github.com:jongminchung/jongminchung.git")).toBe(
      "jongminchung/jongminchung",
    );
    expect(normalizeGitHubRemote("https://github.com/jongminchung/jongminchung.git")).toBe(
      "jongminchung/jongminchung",
    );
    expect(() => normalizeGitHubRemote("https://example.com/repository.git")).toThrow(
      "Unsupported GitHub origin",
    );
  });

  it("blocks recreation when a later stable release exists", () => {
    expect(findNewerReleaseTags(["git-client-1.0.0", "git-client-1.0.1"])).toEqual([
      "git-client-1.0.1",
    ]);
    expect(findNewerReleaseTags(["git-client-0.9.0", "unrelated-2.0.0"])).toEqual([]);
  });

  it("extracts a mounted volume path from hdiutil output", () => {
    expect(parseMountPoint("/dev/disk4\tApple_HFS\t/Volumes/Git Client 1.0.0\n")).toBe(
      "/Volumes/Git Client 1.0.0",
    );
  });
});
