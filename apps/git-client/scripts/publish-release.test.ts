import { describe, expect, it } from "vitest";
import {
  assertMonotonicReleaseVersion,
  assertReleaseMetadata,
  createGhDeleteTagArguments,
  createGhReleaseArguments,
  createGhTagReferenceArguments,
  createGitHubEnvironment,
  createReleaseNotes,
  createReleaseTag,
  createReleaseTitle,
  parsePublishArguments,
  parseReleaseMetadata,
} from "./publish-release.ts";

describe("불변 Git 클라이언트 릴리스 게시자", () => {
  it("[성공] 요청한 stable version으로 릴리스 ID를 생성함", () => {
    expect(createReleaseNotes("1.2.3")).toBe(
      "# 1.2.3\n\nManual Git Client release.\n",
    );
    expect(() => createReleaseNotes("1.2.3-beta.1")).toThrow(
      "stable semantic version",
    );
  });

  it("[실패] 기존 stable release보다 크지 않은 version을 거부함", () => {
    expect(
      assertMonotonicReleaseVersion("1.2.0", [
        "unrelated-9.0.0",
        "git-client-1.1.9",
      ]),
    ).toBe("1.2.0");
    expect(() =>
      assertMonotonicReleaseVersion("1.2.0", ["git-client-1.2.0"]),
    ).toThrow("newer than 1.2.0");
    expect(() =>
      assertMonotonicReleaseVersion("1.2.0", ["git-client-2.0.0"]),
    ).toThrow("newer than 2.0.0");
  });

  it("[성공] 소속된 태그, 및 초안 작성을 사용함", () => {
    expect(createReleaseTag("1.0.0")).toBe("git-client-1.0.0");
    expect(createReleaseTitle("1.0.0")).toBe("Git Client 1.0.0");
    expect(
      createGhReleaseArguments({
        artifacts: {
          checksum: "/tmp/app.dmg.sha256",
          dmg: "/tmp/app.dmg",
          provenance: "/tmp/app.dmg.provenance.json",
        },
        notesFile: "/tmp/notes.md",
        sha: "abc123",
        version: "1.0.0",
      }),
    ).toEqual([
      "release",
      "create",
      "git-client-1.0.0",
      "/tmp/app.dmg",
      "/tmp/app.dmg.sha256",
      "/tmp/app.dmg.provenance.json",
      "--repo",
      "jongminchung/jongminchung",
      "--target",
      "abc123",
      "--title",
      "Git Client 1.0.0",
      "--notes-file",
      "/tmp/notes.md",
      "--draft",
    ]);
    expect(createGhTagReferenceArguments("git-client-1.0.0")).toEqual([
      "api",
      "repos/jongminchung/jongminchung/git/ref/tags/git-client-1.0.0",
      "--jq",
      ".object.sha",
    ]);
    expect(createGhDeleteTagArguments("git-client-1.0.0")).toEqual([
      "api",
      "--method",
      "DELETE",
      "repos/jongminchung/jongminchung/git/refs/tags/git-client-1.0.0",
    ]);
  });

  it("[성공] 방향 GH_PAT를 하위 변형에서 사용하는 GH_TOKEN에 매핑함", () => {
    expect(createGitHubEnvironment({ GH_PAT: "local-token" })).toMatchObject({
      GH_PAT: "local-token",
      GH_TOKEN: "local-token",
    });
    expect(
      createGitHubEnvironment({ GH_PAT: "local", GH_TOKEN: "ci" }).GH_TOKEN,
    ).toBe("ci");
    expect(() => createGitHubEnvironment({})).toThrow("GH_TOKEN");
  });

  it("[성공] 게시하기 전에 GitHub를 통해 데이터를 감시함", () => {
    const metadata = parseReleaseMetadata(
      JSON.stringify({
        assets: [
          { name: "Git-Client_1.0.0_macos_arm64.dmg" },
          { name: "Git-Client_1.0.0_macos_arm64.dmg.sha256" },
          {
            name: "Git-Client_1.0.0_macos_arm64.dmg.provenance.json",
          },
        ],
        isDraft: true,
        isPrerelease: false,
        name: "Git Client 1.0.0",
        tagName: "git-client-1.0.0",
      }),
    );

    expect(() => assertReleaseMetadata(metadata, "1.0.0", true)).not.toThrow();
    expect(() => assertReleaseMetadata(metadata, "1.0.0", false)).toThrow(
      "publication state",
    );
    expect(() => parseReleaseMetadata("[]")).toThrow("object");
  });

  it("[성공] 테스트 실행 게시자 지명만 인정함", () => {
    expect(parsePublishArguments(["--dry-run", "1.2.3"])).toEqual({
      dryRun: true,
      version: "1.2.3",
    });
    expect(() => parsePublishArguments(["--verbose"])).toThrow(
      "Unknown release argument",
    );
    expect(() => parsePublishArguments([])).toThrow(
      "exactly one release version",
    );
  });
});
