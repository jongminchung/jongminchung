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

async function openImmersivePopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator("#immersive-translate-popup")).toBeVisible();
  await expect(page.getByText("오른쪽 번역 버튼을 사용하세요")).toBeVisible();
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
  const controlBox = await control.boundingBox();
  expect(controlBox?.width).toBeLessThanOrEqual(42);
  expect(controlBox?.height).toBeLessThanOrEqual(42);
  await expect(page.getByTestId("floating-translate-tooltip")).toHaveText("클릭 번역");
  await expect(page.getByTestId("translated-block")).toHaveCount(0);
  await control.click();
  await expect(page.getByTestId("floating-translate-control")).toHaveCount(1);
  await expect(page.locator("#tab-shelf-translation-bridge-status")).toHaveCSS("opacity", "0");
}

async function showActiveCaptionCue(page: Page, seconds: number): Promise<void> {
  await expect(page.getByTestId("video-auto-subtitle-status")).toContainText(/Render/i, {
    timeout: 60_000,
  });
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

async function assertMinimalPopup(popup: Page): Promise<void> {
  await expect(popup.getByText("오른쪽 번역 버튼을 사용하세요")).toBeVisible();
  await expect(popup.getByTestId("popup-floating-toggle-guidance")).toContainText("클릭 번역");
  await expect(popup.getByTestId("popup-provider-status")).toContainText("Default Docker");
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
    await expect(articlePage.getByTestId("translated-block").first()).not.toBeVisible();
    await articlePage.getByTestId("floating-translate-control").click();
    await expect(articlePage.getByTestId("translated-block").first()).toBeVisible();
    await expect(articlePage.getByTestId("floating-translate-gear")).toHaveCount(0);
    await expect(articlePage.getByTestId("translation-service-select")).toHaveCount(0);
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
    expect(Math.max(...requestBatchSizes)).toBeLessThanOrEqual(4);
  });
});

if (envFlag("REAL_TRANSLATION_QA")) {
  test.describe("Immersive Translate Docker provider QA", () => {
    test("uses Docker LibreTranslate for Go documentation fixture translation", async ({
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

    test("uses Docker LibreTranslate for automatic YouTube-style subtitle translation", async ({
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
      expectKoreanText(translatedText.join("\n"));
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

      await seedSettingsFromPopup(context, extensionId, {
        ...realProviderSettings(),
        targetLanguage: "ko",
      });
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
