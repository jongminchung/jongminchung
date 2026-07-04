import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesPath = fileURLToPath(new URL("./styles.css", import.meta.url));
const baselinePath = fileURLToPath(new URL("./baseline.css", import.meta.url));

describe("@jongminchung/ui stylesheets", () => {
  it("keeps token styles separate from optional app baseline globals", async () => {
    const styles = await readFile(stylesPath, "utf8");
    const baseline = await readFile(baselinePath, "utf8");

    expect(styles).toContain('@source "./components";');
    expect(styles).toContain("@theme inline");
    expect(styles).toContain("--ds-color-ink: #171717;");
    expect(styles).toContain("--ds-color-canvas: #fafafa;");
    expect(styles).toContain("--font-geist: Geist, Arial, sans-serif;");
    expect(styles).toContain(".ds-gradient-mesh");
    expect(styles).not.toContain("#cc785c");
    expect(styles).not.toContain("Cormorant");
    expect(styles).not.toMatch(/^body\s*{/m);
    expect(styles).not.toMatch(/^a\s*{/m);
    expect(styles).not.toContain("::selection");
    expect(baseline).toMatch(/^body\s*{/m);
    expect(baseline).toContain("::selection");
  });
});
