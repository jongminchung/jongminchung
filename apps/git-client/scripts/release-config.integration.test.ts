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
    expect(triggerBlock?.trim()).toBe("workflow_dispatch:");
}

describe("Git 클라이언트 릴리스 구성 변경", () => {
    it("[성공] 매뉴얼로 교체된 릴리스 버전 하나를 사용함", () => {
        expect(packageConfig.version).toBe("1.0.0");
        expect(packageConfig.scripts.release).toBe(
            "node scripts/publish-release.ts",
        );
        expect(packageConfig.scripts["release:dry-run"]).toBe(
            "node scripts/publish-release.ts --dry-run",
        );
        expectManualWorkflow(gitClientWorkflow);
        expect(gitClientWorkflow).toContain(
            'test "$GITHUB_REF" = "refs/heads/main"',
        );
        expect(gitClientWorkflow).toContain("release:validate-local -- 1.0.0");
        expect(gitClientWorkflow).toContain(
            "Publish fixed Git Client 1.0.0 release",
        );
        expect(gitClientWorkflow).toContain("GH_PAT: ${{ secrets.GH_PAT }}");
        expect(gitClientWorkflow).not.toContain("secrets.GITHUB_TOKEN");
    });

    it("[성공] 모든 스파이스샷을 1.0.0으로 수동으로 바뀐다", () => {
        expectManualWorkflow(packageWorkflow);
        expect(packageWorkflow).toContain('select(.name == "1.0.0")');
        expect(packageWorkflow).toContain("Publish tooling 1.0.0");
        expect(packageWorkflow).toContain("Publish ui 1.0.0");
        expect(packageWorkflow).toContain("package-integrities.tsv");
        expect(packageWorkflow).toContain(
            "Verify published integrity and consumer installation",
        );
        expect(packageWorkflow).toContain('grep -q "HTTP 404"');
        expect(packageWorkflow).toContain("GH_PAT: ${{ secrets.GH_PAT }}");
        expect(packageWorkflow).toContain("Remove GitHub Packages auth");
        expect(packageWorkflow).not.toContain("remark-plantuml");
        expect(packageWorkflow).not.toContain("secrets.GITHUB_TOKEN");
    });

    it("[실패]업데이트 데이터 제외 및 외계인 같은 임시 전자 방출 장치를 일치함", () => {
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
