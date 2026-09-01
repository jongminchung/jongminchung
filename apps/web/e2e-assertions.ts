import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** `expectNoHorizontalOverflow` 공개 기능을 제공함 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.documentElement;
        if (root.scrollWidth <= root.clientWidth) return [];

        const offenders = [...document.body.querySelectorAll<HTMLElement>("*")]
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.left < 0 || bounds.right > root.clientWidth;
          })
          .slice(0, 8)
          .map((element) => {
            const identifier = element.id
              ? `#${element.id}`
              : [element.tagName.toLowerCase(), ...element.classList]
                  .slice(0, 4)
                  .join(".");
            const bounds = element.getBoundingClientRect();
            return `${identifier} (${Math.round(bounds.left)}..${Math.round(bounds.right)})`;
          });

        return [
          `document (${root.clientWidth}..${root.scrollWidth})`,
          ...offenders,
        ];
      }),
    )
    .toEqual([]);
}

/** 요소가 viewport 안에서 독립적인 가로 스크롤 영역을 제공하는지 검증함 */
export async function expectContainedHorizontalScroller(
  locator: Locator,
): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate((element) => ({
        contained:
          element.getBoundingClientRect().left >= 0 &&
          element.getBoundingClientRect().right <=
            document.documentElement.clientWidth,
        scrollable: element.scrollWidth > element.clientWidth,
      })),
    )
    .toEqual({ contained: true, scrollable: true });
}

/** 시각 비교 전에 font와 현재 viewport 이미지를 안정화하고 스냅샷을 검증함 */
export async function expectPageToMatchScreenshot(
  page: Page,
  snapshotName: string,
): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const viewportImages = [...document.images].filter((image) => {
      const bounds = image.getBoundingClientRect();
      return (
        bounds.bottom > 0 &&
        bounds.right > 0 &&
        bounds.top < window.innerHeight &&
        bounds.left < window.innerWidth
      );
    });
    await Promise.all(
      viewportImages.map((image) => image.decode().catch(() => undefined)),
    );
  });
  await expect(page).toHaveScreenshot(snapshotName, { timeout: 30_000 });
}

/** `expectNoAccessibilityViolations` 공개 기능을 제공함 */
export async function expectNoAccessibilityViolations(
  page: Page,
  selector?: string,
  impacts?: readonly string[],
): Promise<void> {
  let scan = new AxeBuilder({ page });
  if (selector !== undefined) scan = scan.include(selector);
  const violations = (await scan.analyze()).violations;
  expect(
    impacts === undefined
      ? violations
      : violations.filter((violation) =>
          impacts.includes(violation.impact ?? ""),
        ),
  ).toEqual([]);
}
