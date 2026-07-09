import type { BrowserContext, Page, Route } from "@playwright/test";
import {
  DEFAULT_LOCAL_TRANSLATION_SETTINGS,
  type LocalTranslationSettings,
} from "../../src/lib/local-translation";
import { expect, test } from "./fixtures";
import { captureQaScreenshot } from "./qa-artifacts";

const LOCAL_TRANSLATION_STORAGE_KEY = "TS_localTranslation";
const DEFAULT_TRANSLATION_ENDPOINT = "http://127.0.0.1:5000/translate";
const WEBPAGE_REFERENCE_VIEWPORT = { width: 1440, height: 1000 } as const;
const VIDEO_REFERENCE_VIEWPORT = { width: 1440, height: 900 } as const;

interface ExtensionStorage {
  readonly storage: {
    readonly local: {
      readonly set: (items: Record<string, unknown>) => Promise<void>;
    };
  };
}

interface ElementBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function requireElementBox(box: ElementBox | null, label: string): ElementBox {
  if (box === null) throw new Error(`${label} is not visible.`);
  return box;
}

async function assertFloatingOverlayLayout(page: Page): Promise<void> {
  const controlBox = await page.getByTestId("floating-translate-control").boundingBox();
  const control = requireElementBox(controlBox, "floating control");
  await expect(page.getByTestId("floating-translate-control")).toHaveText("TR");
  expect(control.width).toBeLessThanOrEqual(36);
  expect(control.height).toBeLessThanOrEqual(36);
  expect(control.x).toBeGreaterThanOrEqual(0);
  expect(control.y).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId("floating-translate-status")).toHaveCount(0);
  await expect(page.getByTestId("floating-translate-tooltip")).toHaveCount(0);
  await expect(page.getByTestId("floating-translate-close")).toHaveCount(0);
}

async function expectFloatingSessionInactive(page: Page): Promise<void> {
  await expect(page.getByTestId("floating-translate-control")).toHaveAttribute(
    "data-state",
    "inactive",
  );
  await expect(page.getByTestId("floating-translate-control")).toHaveAttribute(
    "aria-label",
    "페이지 번역 켜기",
  );
  await expect(page.getByTestId("floating-translate-active-indicator")).toHaveCount(0);
}

async function expectFloatingSessionActive(page: Page): Promise<void> {
  await expect(page.getByTestId("floating-translate-control")).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(page.getByTestId("floating-translate-control")).toHaveAttribute(
    "aria-label",
    "페이지 번역 끄기",
  );
  await expect(page.getByTestId("floating-translate-active-indicator")).toBeVisible();
}

async function openImmersivePopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator("#immersive-translate-popup")).toBeVisible();
  await expect(page.getByRole("heading", { name: "페이지 번역" })).toBeVisible();
  return page;
}

async function seedLocalTranslationSettings(
  page: Page,
  settings: LocalTranslationSettings,
): Promise<void> {
  await page.evaluate(
    async ({ key, value }) => {
      const extensionWindow = window as unknown as Window & { chrome: ExtensionStorage };
      await extensionWindow.chrome.storage.local.set({ [key]: value });
    },
    { key: LOCAL_TRANSLATION_STORAGE_KEY, value: settings },
  );
}

async function seedSettingsFromPopup(
  context: BrowserContext,
  extensionId: string,
  settings: LocalTranslationSettings,
): Promise<void> {
  const popup = await openImmersivePopup(context, extensionId);
  await seedLocalTranslationSettings(popup, settings);
  await popup.close();
}

function envFlag(name: string): boolean {
  return process.env[name] === "1" || process.env[name]?.toLowerCase() === "true";
}

function realTranslationEndpoint(): string {
  return process.env.LOCAL_TRANSLATION_ENDPOINT?.trim() || DEFAULT_TRANSLATION_ENDPOINT;
}

function expectKoreanText(text: string): void {
  expect(text).toMatch(/[가-힣]/);
}

function hasKoreanText(text: string): boolean {
  return /[가-힣]/.test(text);
}

function expectOppositeKoEnCaptionTranslation(input: {
  readonly originalText: string;
  readonly translatedText: string;
}): void {
  if (hasKoreanText(input.originalText)) {
    expect(input.translatedText).toMatch(/[A-Za-z]/);
    return;
  }
  expectKoreanText(input.translatedText);
}

function localSettings(
  overrides: Partial<LocalTranslationSettings> = {},
): LocalTranslationSettings {
  return {
    ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
    enabled: true,
    endpoint: DEFAULT_TRANSLATION_ENDPOINT,
    apiKey: "",
    sourceLanguage: "auto",
    targetLanguage: "ko-en",
    batchSize: 10,
    cacheEnabled: false,
    cacheTtlMinutes: 1440,
    clearCacheOnDisable: false,
    ...overrides,
  };
}

function realProviderSettings(): LocalTranslationSettings {
  return localSettings({
    endpoint: realTranslationEndpoint(),
    apiKey: process.env.LOCAL_TRANSLATION_API_KEY ?? "",
    sourceLanguage: process.env.LOCAL_TRANSLATION_SOURCE ?? "auto",
    targetLanguage: process.env.LOCAL_TRANSLATION_TARGET ?? "ko-en",
    batchSize: Number.parseInt(process.env.LOCAL_TRANSLATION_BATCH_SIZE ?? "50", 10),
  });
}

function realGoDocsUrl(): string {
  return process.env.REAL_GO_DOCS_URL?.trim() || "https://go.dev/doc/effective_go";
}

function realYouTubeUrl(): string {
  return process.env.REAL_YOUTUBE_URL?.trim() || "https://www.youtube.com/watch?v=YS4e4q9oBaU";
}

async function translateWithFloatingToggle(page: Page): Promise<void> {
  const control = page.getByTestId("floating-translate-control");
  await expect(control).toHaveCount(1);
  await expect(control).toBeVisible({ timeout: 30_000 });
  await assertFloatingOverlayLayout(page);
  await expectFloatingSessionInactive(page);
  await expect(page.getByTestId("translated-block")).toHaveCount(0);
  await control.click();
  await expect(page.getByTestId("floating-translate-control")).toHaveCount(1);
  await expect(page.locator("#tab-shelf-translation-bridge-status")).toHaveCSS("opacity", "0");
}

async function showActiveCaptionCue(page: Page, seconds: number): Promise<void> {
  await expect(page.getByTestId("video-auto-subtitle-status")).toContainText(
    /자막 번역(을 표시하는 중|이 표시되었습니다| 버퍼를 준비하는 중)/,
    { timeout: 60_000 },
  );
  await page.evaluate(async (fallbackTimeSeconds) => {
    const video = document.querySelector("video");
    if (!video) throw new Error("Caption video element is missing.");
    const bridge = (
      window as Window & {
        __tabShelfTranslationBridge?: {
          renderedCues?: readonly {
            readonly startTimeSeconds?: unknown;
            readonly endTimeSeconds?: unknown;
          }[];
        };
      }
    ).__tabShelfTranslationBridge;
    const firstCue = bridge?.renderedCues?.find(
      (cue) =>
        typeof cue.startTimeSeconds === "number" &&
        Number.isFinite(cue.startTimeSeconds) &&
        typeof cue.endTimeSeconds === "number" &&
        Number.isFinite(cue.endTimeSeconds) &&
        cue.endTimeSeconds > cue.startTimeSeconds,
    );
    const currentTimeSeconds = firstCue
      ? Math.max(0, firstCue.startTimeSeconds + 0.05)
      : fallbackTimeSeconds;
    video.currentTime = currentTimeSeconds;
    for (let index = 0; index < 3; index += 1) {
      video.dispatchEvent(new Event("timeupdate"));
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
  }, seconds);
}

async function showAfterRenderedCaptionWindow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const video = document.querySelector("video");
    if (!video) throw new Error("Caption video element is missing.");
    const bridge = (
      window as Window & {
        __tabShelfTranslationBridge?: {
          renderedCues?: readonly {
            readonly endTimeSeconds?: unknown;
          }[];
        };
      }
    ).__tabShelfTranslationBridge;
    const lastCueEnd = Math.max(
      0,
      ...(bridge?.renderedCues ?? [])
        .map((cue) => cue.endTimeSeconds)
        .filter(
          (endTimeSeconds): endTimeSeconds is number =>
            typeof endTimeSeconds === "number" && Number.isFinite(endTimeSeconds),
        ),
    );
    video.currentTime = lastCueEnd + 10;
    for (let index = 0; index < 3; index += 1) {
      video.dispatchEvent(new Event("timeupdate"));
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
  });
}

async function assertMinimalPopup(popup: Page): Promise<void> {
  await expect(popup.getByRole("heading", { name: "페이지 번역" })).toBeVisible();
  await expect(popup.getByTestId("popup-floating-toggle-guidance")).toContainText(
    "오른쪽 번역 버튼",
  );
  await expect(popup.getByTestId("popup-translation-status")).toContainText(
    /번역 연결 확인 중|로컬 번역 연결됨|번역 연결 실패|번역 꺼짐/,
  );
  await expect(popup.locator("body")).not.toContainText(
    /provider|MLX|LibreTranslate|browser-detectable|caption cues|script|스크립트|브라우저|endpoint/i,
  );
  await expect(popup.getByTestId("translation-service-select")).toHaveCount(0);
  await expect(popup.getByTestId("target-language-select")).toHaveCount(0);
  await expect(popup.getByTestId("provider-settings-local-endpoint")).toHaveCount(0);
  await expect(popup.getByTestId("document-tool-entry")).toHaveCount(0);
  await expect(popup.getByTestId("more-menu")).toHaveCount(0);
  await expect(popup.getByText("PDF/ePub")).toHaveCount(0);
  await expect(popup.getByText("More")).toHaveCount(0);
}

test.describe("Immersive Translate floating toggle QA", () => {
  test("shows a minimal popup and removes settings/document command-center controls", async ({
    context,
    extensionId,
    localSite,
  }, testInfo) => {
    const page = await context.newPage();
    await page.goto(`${localSite.origin}/article`);

    const popup = await openImmersivePopup(context, extensionId);
    await assertMinimalPopup(popup);
    await captureQaScreenshot(testInfo, popup, "production-alignment", "popup-minimal-status.png", {
      fullPage: false,
    });
  });

  test("uses the right-side floating toggle to translate and toggle a webpage", async ({
    context,
    localSite,
  }, testInfo) => {
    const requests: unknown[] = [];
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
        readonly source?: unknown;
        readonly target?: unknown;
      };
      requests.push(payload);
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => {
            if (text.includes("Opening paragraph")) return "웹페이지 번역 첫 문단";
            if (text.includes("Repeated paragraph")) return "웹페이지 번역 반복 문단";
            if (text.includes("First list item")) return "웹페이지 번역 목록";
            if (text.includes("Quoted insight")) return "웹페이지 번역 인용문";
            return "웹페이지 번역 제목";
          }),
        }),
      });
    });

    const articlePage = await context.newPage();
    await articlePage.setViewportSize(WEBPAGE_REFERENCE_VIEWPORT);
    await articlePage.goto(`${localSite.origin}/article`);
    await translateWithFloatingToggle(articlePage);

    await expect(articlePage.getByText("웹페이지 번역 첫 문단")).toBeVisible();
    await expectFloatingSessionActive(articlePage);
    await assertFloatingOverlayLayout(articlePage);
    await expect(articlePage.getByTestId("source-block").first()).toBeVisible();
    await expect(articlePage.getByTestId("translated-block").first()).toBeVisible();
    await captureQaScreenshot(
      testInfo,
      articlePage,
      "production-alignment",
      "article-floating-toggle-translation.png",
      { fullPage: false },
    );
    expect(requests[0]).toMatchObject({ source: "en", target: "ko" });

    await articlePage.getByTestId("floating-translate-control").click();
    await expectFloatingSessionInactive(articlePage);
    await expect(articlePage.getByTestId("translated-block")).toHaveCount(0);
    await expect(articlePage.getByTestId("floating-translate-gear")).toHaveCount(0);
    await expect(articlePage.getByTestId("translation-service-select")).toHaveCount(0);
  });

  test("keeps webpage translation enabled for the browser session", async ({
    context,
    localSite,
  }) => {
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => {
            if (text.includes("Second page opening")) return "세션 두 번째 페이지 번역";
            if (text.includes("Third page should")) return "세션 꺼짐 후 번역되면 안 됨";
            if (text.includes("Opening paragraph")) return "세션 첫 페이지 번역";
            return "세션 페이지 번역";
          }),
        }),
      });
    });

    const firstPage = await context.newPage();
    await firstPage.goto(`${localSite.origin}/article`);
    await translateWithFloatingToggle(firstPage);
    await expect(firstPage.getByText("세션 첫 페이지 번역")).toBeVisible();
    await expectFloatingSessionActive(firstPage);

    const secondPage = await context.newPage();
    await secondPage.goto(`${localSite.origin}/article-next`);
    await expect(secondPage.getByText("세션 두 번째 페이지 번역")).toBeVisible({
      timeout: 30_000,
    });
    await expectFloatingSessionActive(secondPage);

    await secondPage.getByTestId("floating-translate-control").click();
    await expectFloatingSessionInactive(secondPage);
    await expect(secondPage.getByTestId("translated-block")).toHaveCount(0);

    const thirdPage = await context.newPage();
    await thirdPage.goto(`${localSite.origin}/article-third`);
    await expect(thirdPage.getByTestId("floating-translate-control")).toBeVisible({
      timeout: 30_000,
    });
    await expectFloatingSessionInactive(thirdPage);
    await expect(thirdPage.getByTestId("translated-block")).toHaveCount(0);
    await expect(thirdPage.getByText("세션 꺼짐 후 번역되면 안 됨")).toHaveCount(0);
  });

  test("auto-translates active sessions after same-tab and SPA navigation", async ({
    context,
    localSite,
  }) => {
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => {
            if (text.includes("Second page opening")) return "같은 탭 두 번째 페이지 번역";
            if (text.includes("SPA first page body")) return "SPA 첫 페이지 자동 번역";
            if (text.includes("SPA second page body")) return "SPA 두 번째 페이지 자동 번역";
            if (text.includes("Opening paragraph")) return "같은 탭 첫 페이지 번역";
            return "자동 이동 번역";
          }),
        }),
      });
    });

    const page = await context.newPage();
    await page.goto(`${localSite.origin}/article`);
    await translateWithFloatingToggle(page);
    await expect(page.getByText("같은 탭 첫 페이지 번역")).toBeVisible();
    await expectFloatingSessionActive(page);

    await page.goto(`${localSite.origin}/article-next`);
    await expect(page.getByText("같은 탭 두 번째 페이지 번역")).toBeVisible({
      timeout: 30_000,
    });
    await expectFloatingSessionActive(page);

    await page.goto(`${localSite.origin}/article-spa`);
    await expect(page.getByText("SPA 첫 페이지 자동 번역")).toBeVisible({ timeout: 30_000 });
    await page.locator("#spa-route").click();
    await expect(page).toHaveURL(/\/article-spa-next$/);
    await expect(page.getByText("SPA 두 번째 페이지 자동 번역")).toBeVisible({
      timeout: 30_000,
    });
    await expectFloatingSessionActive(page);
  });

  test("renders the first two viewport range before background webpage chunks", async ({
    context,
    localSite,
  }) => {
    const requests: (readonly string[])[] = [];
    let releaseSecondRequest: (() => void) | null = null;
    const secondRequestRelease = new Promise<void>((resolve) => {
      releaseSecondRequest = resolve;
    });
    let deferredRequestCount = 0;
    let releaseDeferredRequest: (() => void) | null = null;
    const deferredRequestRelease = new Promise<void>((resolve) => {
      releaseDeferredRequest = resolve;
    });
    const requestTextsAt = (index: number): readonly string[] => {
      const request = requests[index];
      if (!request) throw new Error(`Translation request ${index + 1} was not captured.`);
      return request;
    };
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      requests.push(sourceTexts);
      if (requests.length === 2) {
        await secondRequestRelease;
      }
      if (sourceTexts.some((text) => text.includes("Deferred bottom paragraph"))) {
        deferredRequestCount += 1;
        await deferredRequestRelease;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => {
            if (text === "Priority Article Fixture") return "첫 렌더 제목 번역";
            if (text.includes("Immediate paragraph")) return "우선순위 상단 문단 번역";
            if (text.includes("Deferred bottom paragraph")) return "백그라운드 하단 문단 번역";
            return "우선순위 문서 번역";
          }),
        }),
      });
    });

    const priorityPage = await context.newPage();
    await priorityPage.setViewportSize({ width: 900, height: 360 });
    await priorityPage.goto(`${localSite.origin}/article-priority`);
    await translateWithFloatingToggle(priorityPage);

    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    expect(requestTextsAt(0)).toHaveLength(1);
    expect(requestTextsAt(1)).toHaveLength(1);
    await expect(priorityPage.getByText("첫 렌더 제목 번역")).toBeVisible({
      timeout: 10_000,
    });
    await expect(priorityPage.getByText("우선순위 상단 문단 번역")).toHaveCount(0);
    releaseSecondRequest?.();
    await expect(priorityPage.getByText("우선순위 상단 문단 번역").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(priorityPage.getByText("백그라운드 하단 문단 번역")).toHaveCount(0);
    await expect.poll(() => deferredRequestCount, { timeout: 10_000 }).toBeGreaterThan(0);
    releaseDeferredRequest?.();
    await expect(priorityPage.getByText("백그라운드 하단 문단 번역").first()).toBeVisible({
      timeout: 10_000,
    });
    await expectFloatingSessionActive(priorityPage);
  });

  test("translates webpage blocks below the initial viewport", async ({ context, localSite }) => {
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) =>
            text.includes("paragraph 12") ? "긴 문서 마지막 문단까지 번역됨" : "긴 문서 본문 번역",
          ),
        }),
      });
    });

    const longPage = await context.newPage();
    await longPage.setViewportSize({ width: 900, height: 360 });
    await longPage.goto(`${localSite.origin}/article-many`);
    await translateWithFloatingToggle(longPage);

    const finalTranslation = longPage.getByText("긴 문서 마지막 문단까지 번역됨");
    await finalTranslation.scrollIntoViewIfNeeded();
    await expect(finalTranslation).toBeVisible();
    await expect(longPage.getByTestId("translated-block")).toHaveCount(13);
    await expectFloatingSessionActive(longPage);
  });

  test("translates readable table cells in documentation pages", async ({ context, localSite }) => {
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => {
            if (text === "Provider") return "제공자";
            if (text.includes("AWS Route 53")) return "AWS Route 53 번역";
            if (text.includes("Route 53 public")) return "Route 53 튜토리얼 번역";
            if (text.includes("Google Cloud DNS")) return "Google Cloud DNS 번역";
            return "테이블 문서 번역";
          }),
        }),
      });
    });

    const tablePage = await context.newPage();
    await tablePage.goto(`${localSite.origin}/article-table`);
    await translateWithFloatingToggle(tablePage);

    const table = tablePage.locator("table");
    await expect(table.getByText("제공자")).toBeVisible();
    await expect(table.getByText("AWS Route 53 번역")).toBeVisible();
    await expect(table.getByText("Route 53 튜토리얼 번역")).toBeVisible();
    await expect(table.getByText("Google Cloud DNS 번역")).toBeVisible();
    await expect
      .poll(() => table.locator('[data-tab-shelf-webpage-translation="true"]').count())
      .toBeGreaterThan(5);
    await expectFloatingSessionActive(tablePage);
  });

  test("translates Korean webpages to English through the same floating toggle", async ({
    context,
    localSite,
  }) => {
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
        readonly target?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) =>
            text.includes("첫 번째")
              ? "The first paragraph verifies Korean webpage translation."
              : "Korean Article Fixture",
          ),
        }),
      });
    });

    const koreanPage = await context.newPage();
    await koreanPage.goto(`${localSite.origin}/korean-article`);
    await translateWithFloatingToggle(koreanPage);

    await expect(
      koreanPage.getByText("The first paragraph verifies Korean webpage translation."),
    ).toBeVisible();
    await expectFloatingSessionActive(koreanPage);
  });

  test("places Go documentation translations naturally inside the document", async ({
    context,
    localSite,
  }, testInfo) => {
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) =>
            text.includes("open source")
              ? "Go 프로그래밍 언어는 프로그래머의 생산성을 높이기 위한 오픈 소스 프로젝트입니다."
              : "Go 공식 문서 번역 결과입니다.",
          ),
        }),
      });
    });

    const goDocsPage = await context.newPage();
    await goDocsPage.setViewportSize(WEBPAGE_REFERENCE_VIEWPORT);
    await goDocsPage.goto(`${localSite.origin}/go-docs`);
    await translateWithFloatingToggle(goDocsPage);

    await expect(goDocsPage.getByText("Go 프로그래밍 언어는")).toBeVisible();
    await expect(
      goDocsPage.locator("[data-webpage-inline-translation='true']").first(),
    ).toBeVisible();
    await expect(
      goDocsPage.locator("[data-webpage-paragraph-translation='true']").first(),
    ).toBeVisible();
    await expect(goDocsPage.getByRole("navigation")).toBeVisible();
    await expectFloatingSessionActive(goDocsPage);
    await assertFloatingOverlayLayout(goDocsPage);
    await captureQaScreenshot(
      testInfo,
      goDocsPage,
      "production-alignment",
      "go-docs-floating-webpage-translation.png",
      { fullPage: false },
    );
  });

  test("automatically renders bilingual subtitles on a YouTube-style page", async ({
    context,
    localSite,
  }, testInfo) => {
    const requestBatchSizes: number[] = [];
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      requestBatchSizes.push(sourceTexts.length);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) =>
            text.includes("Second") ? "두 번째 유튜브 자막" : "유튜브 안녕 자막",
          ),
        }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto(`${localSite.origin}/youtube-watch?v=alpha`);
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();
    await expect(youtubePage.getByTestId("translated-block")).toHaveCount(0);

    await showActiveCaptionCue(youtubePage, 1.2);
    await expect(youtubePage.getByText("유튜브 안녕 자막")).toBeVisible();
    await expect(youtubePage.getByTestId("caption-original-line").first()).toBeVisible();
    await expect(youtubePage.getByTestId("caption-translated-line").first()).toBeVisible();
    await captureQaScreenshot(
      testInfo,
      youtubePage,
      "production-alignment",
      "youtube-auto-subtitle-translation.png",
      { fullPage: false },
    );
    await showAfterRenderedCaptionWindow(youtubePage);
    await expect(youtubePage.getByTestId("caption-original-line")).toHaveCount(0);
    await expect(youtubePage.getByTestId("caption-translated-line")).toHaveCount(0);
    expect(Math.max(...requestBatchSizes)).toBeLessThanOrEqual(8);
  });

  test("renders only the latest active caption when YouTube cues overlap", async ({
    context,
    localSite,
  }) => {
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) =>
            text.includes("second") ? "두 번째 겹침 자막" : "첫 번째 겹침 자막",
          ),
        }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto(`${localSite.origin}/youtube-watch?v=overlap`);
    await youtubePage.getByTestId("floating-translate-control").click();
    await expect(youtubePage.getByTestId("video-auto-subtitle-status")).toContainText(
      /자막 번역(을 표시하는 중|이 표시되었습니다| 버퍼를 준비하는 중)/,
      { timeout: 60_000 },
    );

    await youtubePage.evaluate(async () => {
      const video = document.querySelector("video");
      if (!video) throw new Error("Caption video element is missing.");
      video.currentTime = 1.2;
      for (let index = 0; index < 3; index += 1) {
        video.dispatchEvent(new Event("timeupdate"));
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
    });

    await expect(youtubePage.getByTestId("caption-original-line")).toHaveCount(1);
    await expect(youtubePage.getByTestId("caption-translated-line")).toHaveCount(1);
    await expect(youtubePage.getByTestId("caption-original-line")).toHaveText(
      "Overlap second caption",
    );
    await expect(youtubePage.getByTestId("caption-translated-line")).toHaveText(
      "두 번째 겹침 자막",
    );
  });

  test("uses the background YouTube caption gateway when page caption tracks are missing", async ({
    context,
  }) => {
    const captionLanguages: string[] = [];
    await context.route(/https:\/\/www\.youtube\.com\/watch\?/, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><head><title>YouTube Gateway Caption Fixture</title></head><body>
                <main>
                    <h1>YouTube Gateway Caption Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                </main>
                <script>
                    window.ytInitialPlayerResponse = { videoDetails: { videoId: 'background-fallback' } };
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                </script>
            </body></html>`,
      });
    });
    await context.route("**/youtube-captions**", async (route: Route) => {
      const url = new URL(route.request().url());
      const languageCode = url.searchParams.get("languageCode") ?? "en";
      captionLanguages.push(languageCode);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          videoId: url.searchParams.get("videoId") ?? "background-fallback",
          languageCode,
          label: `YouTube ${languageCode} captions`,
          source: "yt-dlp",
          payload: JSON.stringify({
            events: [
              {
                tStartMs: 0,
                dDurationMs: 2000,
                segs: [{ utf8: "Gateway fallback first caption" }],
              },
              {
                tStartMs: 2000,
                dDurationMs: 2000,
                segs: [{ utf8: "Gateway fallback second caption" }],
              },
            ],
          }),
        }),
      });
    });
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) =>
            text.includes("second")
              ? "백그라운드 두 번째 자막 번역"
              : "백그라운드 첫 번째 자막 번역",
          ),
        }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto("https://www.youtube.com/watch?v=background-fallback");
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();

    await showActiveCaptionCue(youtubePage, 1.2);
    await expect(youtubePage.getByText("백그라운드 첫 번째 자막 번역")).toBeVisible();
    expect(captionLanguages).toContain("en");
  });

  test("uses the currently selected Korean YouTube caption for background gateway captions", async ({
    context,
  }) => {
    const captionLanguages: string[] = [];
    const translationRequests: unknown[] = [];
    await context.route(/https:\/\/www\.youtube\.com\/watch\?/, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><head><title>한국어 영상 자막 Fixture</title></head><body>
                <main>
                    <h1>한국어 영상 자막 Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                </main>
                <script>
                    window.ytInitialPlayerResponse = { videoDetails: { videoId: 'selected-korean-fallback' } };
                    const player = document.querySelector('#movie_player');
                    player.getPlayerResponse = () => window.ytInitialPlayerResponse;
                    player.getOption = (namespace, option) => {
                        if (namespace === 'captions' && option === 'track') {
                            return { languageCode: 'ko', label: 'Korean' };
                        }
                        return null;
                    };
                </script>
            </body></html>`,
      });
    });
    await context.route("**/youtube-captions**", async (route: Route) => {
      const url = new URL(route.request().url());
      const languageCode = url.searchParams.get("languageCode") ?? "en";
      captionLanguages.push(languageCode);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          videoId: url.searchParams.get("videoId") ?? "selected-korean-fallback",
          languageCode,
          label: `YouTube ${languageCode} captions`,
          source: "yt-dlp",
          payload: JSON.stringify({
            events: [
              {
                tStartMs: 0,
                dDurationMs: 2000,
                segs: [
                  {
                    utf8:
                      languageCode === "ko"
                        ? "한국어 게이트웨이 첫 자막"
                        : "English gateway first caption",
                  },
                ],
              },
            ],
          }),
        }),
      });
    });
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
        readonly source?: unknown;
        readonly target?: unknown;
      };
      translationRequests.push(payload);
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map(() =>
            payload.target === "en"
              ? "Korean gateway caption translation"
              : "잘못된 영어 자막 재번역",
          ),
        }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto("https://www.youtube.com/watch?v=selected-korean-fallback");
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();

    await showActiveCaptionCue(youtubePage, 1.2);
    await expect(youtubePage.getByText("Korean gateway caption translation")).toBeVisible();
    expect(captionLanguages[0]).toBe("ko");
    expect(translationRequests[0]).toMatchObject({ source: "ko", target: "en" });
  });

  test("keeps YouTube subtitle translation requests small for fast first render", async ({
    context,
    localSite,
  }) => {
    const requestBatchSizes: number[] = [];
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      requestBatchSizes.push(sourceTexts.length);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => `번역: ${text}`),
        }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto(`${localSite.origin}/youtube-watch?v=batch`);
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();

    await expect(youtubePage.getByTestId("caption-translated-line").first()).toBeVisible({
      timeout: 60_000,
    });
    expect(requestBatchSizes[0]).toBe(3);
    expect(Math.max(...requestBatchSizes)).toBeLessThanOrEqual(8);
  });

  test("keeps a long YouTube caption buffer visible after seeking past the midpoint", async ({
    context,
    localSite,
  }) => {
    const requestBatchSizes: number[] = [];
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      requestBatchSizes.push(sourceTexts.length);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => `번역: ${text}`),
        }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto(`${localSite.origin}/youtube-watch?v=long-buffer`);
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();
    await expect(youtubePage.getByTestId("caption-original-line").first()).toBeVisible({
      timeout: 60_000,
    });

    await expect
      .poll(() => requestBatchSizes.reduce((total, batchSize) => total + batchSize, 0), {
        timeout: 60_000,
      })
      .toBeGreaterThanOrEqual(20);

    await youtubePage.evaluate(async () => {
      const video = document.querySelector("video");
      if (!video) throw new Error("Caption video element is missing.");
      video.currentTime = 40.05;
      for (let index = 0; index < 3; index += 1) {
        video.dispatchEvent(new Event("timeupdate"));
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
    });

    await expect(youtubePage.getByTestId("caption-original-line")).toHaveCount(1);
    await expect(youtubePage.getByTestId("caption-original-line")).toHaveText("Long cue 20");
    expect(requestBatchSizes[0]).toBe(3);
    expect(Math.max(...requestBatchSizes)).toBeLessThanOrEqual(8);
  });

  test("shows original captions while delayed translation fills the buffer", async ({
    context,
    localSite,
  }) => {
    let releaseFirstBatch: (() => void) | null = null;
    let resolveFirstRequest: (() => void) | null = null;
    const firstRequest = new Promise<void>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const firstBatchRelease = new Promise<void>((resolve) => {
      releaseFirstBatch = resolve;
    });

    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      if (sourceTexts.includes("Long cue 0")) {
        resolveFirstRequest?.();
        await firstBatchRelease;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map((text) => `번역: ${text}`),
        }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto(`${localSite.origin}/youtube-watch?v=long-buffer`);
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();
    await firstRequest;

    await expect(youtubePage.getByTestId("caption-original-line")).toHaveText("Long cue 0", {
      timeout: 10_000,
    });
    await expect(youtubePage.getByTestId("caption-translated-line")).toHaveCount(0);

    releaseFirstBatch?.();
    await expect(youtubePage.getByTestId("caption-translated-line")).toHaveText(
      "번역: Long cue 0",
      { timeout: 60_000 },
    );
  });

  test("does not open the YouTube transcript panel when caption payloads are unavailable", async ({
    context,
    localSite,
  }) => {
    await context.route("**/youtube-captions**", async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "captions unavailable" }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto(`${localSite.origin}/youtube-transcript-fallback`);
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();

    await expect(youtubePage.getByTestId("video-auto-subtitle-status")).toContainText(
      /사용할 수 있는 영상 자막이 없습니다|영상 자막 정보를 읽지 못했습니다/,
      { timeout: 60_000 },
    );
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveAttribute(
      "data-state",
      "error",
    );
    await expect(youtubePage.locator("#tab-shelf-translation-bridge-status")).toContainText(
      /사용할 수 있는 영상 자막이 없습니다|영상 자막 정보를 읽지 못했습니다/,
    );
    await assertFloatingOverlayLayout(youtubePage);
    await expect(youtubePage.locator("#transcript-section")).toHaveCSS("display", "none");
    await expect(youtubePage.locator("#transcript-panel")).toHaveAttribute("hidden", "");
    await expect(youtubePage.getByTestId("caption-original-line")).toHaveCount(0);
    await expect(youtubePage.getByTestId("caption-translated-line")).toHaveCount(0);
  });

  test("does not read visible YouTube caption DOM when payloads are unavailable", async ({
    context,
    localSite,
  }) => {
    let translationRequestCount = 0;
    await context.route(DEFAULT_TRANSLATION_ENDPOINT, async (route: Route) => {
      translationRequestCount += 1;
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        readonly q?: unknown;
      };
      const sourceTexts = Array.isArray(payload.q)
        ? payload.q.filter((text): text is string => typeof text === "string")
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translatedText: sourceTexts.map(() => "화면 자막 DOM fallback 번역"),
        }),
      });
    });
    await context.route("**/youtube-captions**", async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "captions unavailable" }),
      });
    });

    const youtubePage = await context.newPage();
    await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
    await youtubePage.goto(`${localSite.origin}/youtube-cc-fallback`);
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveCount(1);
    await youtubePage.getByTestId("floating-translate-control").click();

    await expect(youtubePage.getByTestId("video-auto-subtitle-status")).toContainText(
      /사용할 수 있는 영상 자막이 없습니다|영상 자막 정보를 읽지 못했습니다/,
      { timeout: 60_000 },
    );
    await expect(youtubePage.getByTestId("floating-translate-control")).toHaveAttribute(
      "data-state",
      "error",
    );
    await expect(youtubePage.locator(".ytp-subtitles-button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(youtubePage.getByTestId("caption-original-line")).toHaveCount(0);
    await expect(youtubePage.getByTestId("caption-translated-line")).toHaveCount(0);
    expect(translationRequestCount).toBe(0);
  });
});

if (envFlag("REAL_TRANSLATION_QA")) {
  test.describe("Immersive Translate local translation QA", () => {
    test("uses local translation for Go documentation fixture translation", async ({
      context,
      extensionId,
      localSite,
    }, testInfo) => {
      test.setTimeout(180_000);

      await seedSettingsFromPopup(context, extensionId, realProviderSettings());
      const goDocsPage = await context.newPage();
      await goDocsPage.setViewportSize(WEBPAGE_REFERENCE_VIEWPORT);
      await goDocsPage.goto(`${localSite.origin}/go-docs`);
      await translateWithFloatingToggle(goDocsPage);

      await expect(goDocsPage.getByTestId("translated-block").first()).toBeVisible({
        timeout: 90_000,
      });
      await assertFloatingOverlayLayout(goDocsPage);
      const translatedText = await goDocsPage.getByTestId("translated-block").allTextContents();
      expectKoreanText(translatedText.join("\n"));
      await captureQaScreenshot(
        testInfo,
        goDocsPage,
        "production-alignment",
        "docker-go-docs-floating-translation.png",
        { fullPage: false },
      );
    });

    test("uses local translation for automatic YouTube-style subtitle translation", async ({
      context,
      extensionId,
      localSite,
    }, testInfo) => {
      test.setTimeout(180_000);

      await seedSettingsFromPopup(context, extensionId, realProviderSettings());
      const youtubePage = await context.newPage();
      await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
      await youtubePage.goto(`${localSite.origin}/youtube-watch?v=alpha`);

      await showActiveCaptionCue(youtubePage, 1.2);
      await expect(youtubePage.getByTestId("caption-translated-line").first()).toBeVisible({
        timeout: 90_000,
      });
      const translatedText = await youtubePage
        .getByTestId("caption-translated-line")
        .allTextContents();
      const originalText = await youtubePage.getByTestId("caption-original-line").allTextContents();
      expectOppositeKoEnCaptionTranslation({
        originalText: originalText.join("\n"),
        translatedText: translatedText.join("\n"),
      });
      await captureQaScreenshot(
        testInfo,
        youtubePage,
        "production-alignment",
        "docker-youtube-auto-subtitle-translation.png",
        { fullPage: false },
      );
    });
  });
}

if (envFlag("REAL_NETWORK_QA")) {
  test.describe("Immersive Translate actual network QA", () => {
    test("translates the actual Go official documentation page through the floating toggle", async ({
      context,
      extensionId,
    }, testInfo) => {
      test.setTimeout(240_000);

      await seedSettingsFromPopup(context, extensionId, realProviderSettings());
      const goDocsPage = await context.newPage();
      await goDocsPage.setViewportSize(WEBPAGE_REFERENCE_VIEWPORT);
      await goDocsPage.goto(realGoDocsUrl(), { waitUntil: "domcontentloaded" });
      await expect(goDocsPage.locator("main").first()).toBeVisible({ timeout: 30_000 });
      await translateWithFloatingToggle(goDocsPage);

      await expect(goDocsPage.getByTestId("translated-block").first()).toBeVisible({
        timeout: 210_000,
      });
      await assertFloatingOverlayLayout(goDocsPage);
      const translatedBlockCount = await goDocsPage.getByTestId("translated-block").count();
      expect(translatedBlockCount).toBeGreaterThan(8);
      const translatedText = await goDocsPage.getByTestId("translated-block").allTextContents();
      expectKoreanText(translatedText.join("\n"));
      await captureQaScreenshot(
        testInfo,
        goDocsPage,
        "production-alignment",
        "real-go-official-docs-floating-translation.png",
      );
    });
  });
}

if (envFlag("REAL_YOUTUBE_CAPTION_QA")) {
  test.describe("Immersive Translate actual YouTube caption QA", () => {
    test("translates an actual YouTube video without popup fallback", async ({
      context,
      extensionId,
    }, testInfo) => {
      test.setTimeout(240_000);

      await seedSettingsFromPopup(context, extensionId, realProviderSettings());
      const youtubePage = await context.newPage();
      await youtubePage.setViewportSize(VIDEO_REFERENCE_VIEWPORT);
      await youtubePage.goto(realYouTubeUrl(), { waitUntil: "domcontentloaded" });
      await expect(youtubePage.locator("video, #movie_player").first()).toBeVisible({
        timeout: 45_000,
      });

      await showActiveCaptionCue(youtubePage, 1);
      await expect(youtubePage.getByTestId("caption-translated-line").first()).toBeVisible({
        timeout: 120_000,
      });
      const translatedText = await youtubePage
        .getByTestId("caption-translated-line")
        .allTextContents();
      expectKoreanText(translatedText.join("\n"));
      await captureQaScreenshot(
        testInfo,
        youtubePage,
        "production-alignment",
        "real-youtube-auto-subtitle-translation.png",
      );
    });
  });
}
