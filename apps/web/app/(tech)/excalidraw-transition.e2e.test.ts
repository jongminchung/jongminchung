import { expect, test } from "@playwright/test";

test("[성공] 같은 element 수의 새 scene을 실제 renderer에 반영함", async ({
    page,
}) => {
    await page.goto("/diagrams/fixtures/excalidraw-transition");
    const diagram = page.getByRole("figure", {
        name: "Scene transition fixture",
    });

    await expect(diagram).toHaveAttribute("data-excalidraw-state", "ready");
    await expect(diagram).toHaveAttribute(
        "data-rendered-text-content",
        /"hardware"/u,
    );

    await page.getByRole("button", { name: "Show second scene" }).click();
    await expect(diagram).toHaveAttribute("data-excalidraw-state", "ready");
    await expect(diagram).toHaveAttribute(
        "data-rendered-text-content",
        /"HARDWARE"/u,
    );
    await expect(diagram).toHaveAttribute("data-rendered-element-count", "10");
});
