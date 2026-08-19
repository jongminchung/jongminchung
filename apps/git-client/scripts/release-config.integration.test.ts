import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageConfig = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const gitClientWorkflow = readFileSync(
    new URL("../../../.github/workflows/git-client.yml", import.meta.url),
    "utf8",
);
const packageWorkflow = readFileSync(
    new URL("../../../.github/workflows/publish-packages.yml", import.meta.url),
    "utf8",
);

function expectManualWorkflow(workflow: string): void {
    const triggerBlock = /^on:\n(?<triggers>(?: {2}.+\n)+)/mu.exec(workflow)
        ?.groups?.triggers;
    expect(triggerBlock?.trim().split("\n")[0]).toBe("workflow_dispatch:");
}

function expectInOrder(workflow: string, fragments: readonly string[]): void {
    let previousIndex = -1;
    for (const fragment of fragments) {
        const index = workflow.indexOf(fragment, previousIndex + 1);
        expect(index, `Missing workflow fragment: ${fragment}`).toBeGreaterThan(
            previousIndex,
        );
        previousIndex = index;
    }
}

describe("Git 클라이언트 릴리스 구성 변경", () => {
    it("[성공] manual input의 불변 semantic version release를 사용함", () => {
        expect(packageConfig.version).toBe("1.0.0");
        expect(packageConfig.scripts.release).toBe(
            "node scripts/publish-release.ts",
        );
        expect(packageConfig.scripts["release:dry-run"]).toBe(
            "node scripts/publish-release.ts --dry-run",
        );
        expectManualWorkflow(gitClientWorkflow);
        expect(gitClientWorkflow).toContain("inputs:\n      version:");
        expect(gitClientWorkflow).toContain(
            "Stable semantic version for this immutable release",
        );
        expect(gitClientWorkflow).toContain(
            'test "$GITHUB_REF" = "refs/heads/main"',
        );
        expect(gitClientWorkflow).toContain(
            'release:validate-local -- "${{ inputs.version }}"',
        );
        expect(gitClientWorkflow).toContain(
            "Publish immutable Git Client release",
        );
        expect(gitClientWorkflow).toContain("GH_PAT: ${{ secrets.GH_PAT }}");
        expect(gitClientWorkflow).not.toContain("secrets.GITHUB_TOKEN");
    });

    it("[성공] package 검증 뒤 기존 1.0.0을 교체함", () => {
        expectManualWorkflow(packageWorkflow);
        expect(packageWorkflow).toContain("package: tooling");
        expect(packageWorkflow).toContain("package: ui");
        expect(packageWorkflow).toContain(
            'import-specifier: "@jongminchung/tooling/oxfmt"',
        );
        expect(packageWorkflow).toContain(
            'import-specifier: "@jongminchung/ui/lib/utils"',
        );
        expect(packageWorkflow).toContain("needs: validate");
        expect(packageWorkflow).toContain("run publish:dry-run");
        expect(packageWorkflow).toContain(
            '.github/scripts/delete-version-ids-script.sh\n          "$GITHUB_REPOSITORY_OWNER" "${{ matrix.package }}" "1.0.0"',
        );
        expectInOrder(packageWorkflow, [
            "- name: Delete existing 1.0.0",
            "publish --access public --no-git-checks",
            "Verify registry integrity and clean consumer import",
            "verify-published-package.mjs",
            "- name: Remove GitHub Packages auth",
        ]);
        expect(packageWorkflow).toContain("if: ${{ always() }}");
        expect(packageWorkflow).toContain("GH_PAT: ${{ secrets.GH_PAT }}");
        expect(packageWorkflow).not.toContain("remark-plantuml");
        expect(packageWorkflow).not.toContain("secrets.GITHUB_TOKEN");
    });

    it("[성공] Electron release는 updater와 maker 없이 고정 build script를 사용함", () => {
        expect(packageConfig.scripts["release:build"]).toBe(
            "node scripts/release.ts",
        );
        expect(packageConfig.scripts["release:validate-local"]).toBe(
            "node scripts/release.ts --local-ad-hoc",
        );
        expect(packageConfig.scripts["electron:package"]).toBe(
            "electron-forge package",
        );
        expect(packageConfig.scripts).not.toHaveProperty("electron:make");
        expect(packageConfig.devDependencies).not.toHaveProperty(
            "@electron-forge/maker-dmg",
        );
        expect(packageConfig.devDependencies).not.toHaveProperty(
            "@electron-forge/plugin-auto-unpack-natives",
        );
        expect(packageConfig.devDependencies).not.toHaveProperty("fs-xattr");
        expect(packageConfig.devDependencies["macos-alias"]).toBe("catalog:");
        expect(packageConfig.devDependencies["node-gyp"]).toBe("catalog:");
        expect(packageConfig.dependencies).not.toHaveProperty(
            "electron-updater",
        );
        expect(packageConfig.dependencies).not.toHaveProperty(
            "update-electron-app",
        );
        expect(packageConfig.devDependencies).not.toHaveProperty(
            "electron-updater",
        );
        expect(packageConfig.devDependencies).not.toHaveProperty(
            "update-electron-app",
        );
    });
});
