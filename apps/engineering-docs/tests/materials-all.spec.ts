import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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

test.describe("all material demos", () => {
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

            await page.goto(`/en/deep-dive/${topic}`);
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
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <=
                            window.innerWidth,
                    ),
                )
                .toBe(true);
        });
    }
    test("continuous material animation sustains the frame budget with low CLS", async ({
        page,
    }) => {
        await page.addInitScript(() => {
            const measured = window as Window & {
                __materialLayoutShift: number;
            };
            measured.__materialLayoutShift = 0;
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const shift = entry as PerformanceEntry & {
                        readonly hadRecentInput: boolean;
                        readonly value: number;
                    };
                    if (!shift.hadRecentInput)
                        measured.__materialLayoutShift += shift.value;
                }
            }).observe({ type: "layout-shift", buffered: true });
        });
        await page.goto("/en/deep-dive/the-expensive-main-thread");
        const demo = page.locator(
            '[data-material-demo="the-expensive-main-thread/TransformVsLayoutDemo"]',
        );
        await demo.scrollIntoViewIfNeeded();
        await expect(
            demo.getByRole("button", { name: "Add main thread load" }),
        ).toBeVisible();

        const fps = await page.evaluate(
            () =>
                new Promise<number>((resolveFps) => {
                    const samples: number[] = [];
                    let previous = performance.now();
                    const sample = (time: number): void => {
                        samples.push(time - previous);
                        previous = time;
                        if (samples.length < 60) {
                            requestAnimationFrame(sample);
                            return;
                        }
                        const elapsed = samples.reduce(
                            (sum, value) => sum + value,
                            0,
                        );
                        resolveFps((samples.length * 1000) / elapsed);
                    };
                    requestAnimationFrame(sample);
                }),
        );
        expect(fps).toBeGreaterThanOrEqual(55);
        expect(
            await page.evaluate(
                () =>
                    (
                        window as Window & {
                            readonly __materialLayoutShift: number;
                        }
                    ).__materialLayoutShift,
            ),
        ).toBeLessThan(0.1);
    });
});
