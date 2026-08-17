import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./assertions";

interface ManifestEntry {
    readonly id: string;
    readonly topic: string;
}

const manifest = JSON.parse(
    await readFile(
        resolve(process.cwd(), "generated/materials-manifest.json"),
        "utf8",
    ),
) as readonly ManifestEntry[];
const topics = [...new Set(manifest.map((entry) => entry.topic))];

test.describe("[성공] 모든 자료 데모", () => {
    test.describe.configure({ mode: "serial" });

    for (const topic of topics) {
        test(`${topic} loads every registered demo without runtime errors`, async ({
            page,
        }) => {
            test.setTimeout(60_000);
            const runtimeErrors: string[] = [];
            page.on("pageerror", (error) => runtimeErrors.push(error.message));
            page.on("console", (message) => {
                if (message.type() === "error")
                    runtimeErrors.push(message.text());
            });

            await page.goto(`/en/articles/${topic}`);
            const entries = manifest.filter((entry) => entry.topic === topic);
            const demos = page.locator("[data-material-demo]");
            await expect(demos).toHaveCount(entries.length);
            const accessibilityViolations: string[] = [];

            for (const entry of entries) {
                const demo = page.locator(`[data-material-demo="${entry.id}"]`);
                await demo.scrollIntoViewIfNeeded();
                await expect(demo).toHaveAttribute(
                    "data-material-active",
                    "true",
                );
                await expect
                    .poll(() => demo.locator(":scope > div > *").count())
                    .toBeGreaterThan(0);
                const accessibility = await new AxeBuilder({ page })
                    .include(`[data-material-demo="${entry.id}"]`)
                    .analyze();
                accessibilityViolations.push(
                    ...accessibility.violations
                        .filter((violation) =>
                            ["serious", "critical"].includes(
                                violation.impact ?? "",
                            ),
                        )
                        .flatMap((violation) =>
                            violation.nodes.map(
                                (node) =>
                                    `${entry.id}: ${violation.id} ${node.target.join(" ")} ${node.failureSummary ?? ""}`,
                            ),
                        ),
                );
            }

            expect(runtimeErrors).toEqual([]);
            expect(accessibilityViolations).toEqual([]);
            await expectNoHorizontalOverflow(page);
        });
    }
});
