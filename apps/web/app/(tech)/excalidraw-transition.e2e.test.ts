import { expect, test } from "@playwright/test";

test("[성공] 정적 SVG 다이어그램의 접근성 텍스트를 제공함", async ({
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
  await expect(diagram).toHaveAttribute("data-rendered-element-count", "10");
  await expect(diagram.locator("[data-excalidraw-text=true]")).toContainText(
    "hardware",
  );
});
