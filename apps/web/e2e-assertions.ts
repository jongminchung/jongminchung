import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** `expectNoHorizontalOverflow` 공개 기능을 제공함 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            ),
        )
        .toBe(true);
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
