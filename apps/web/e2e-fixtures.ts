import { expect, test as base, type APIRequestContext } from "@playwright/test";

interface SiteRequestFixtures {
  readonly siteRequest: APIRequestContext;
}

/** 프로젝트 Host를 유지하면서 loopback으로 직접 연결하는 API request fixture */
const test = base.extend<SiteRequestFixtures>({
  siteRequest: async ({ playwright }, use, testInfo) => {
    const configuredBaseUrl = testInfo.project.use.baseURL;
    if (typeof configuredBaseUrl !== "string")
      throw new Error(`Project ${testInfo.project.name} requires a baseURL`);
    const target = new URL(configuredBaseUrl);
    const request = await playwright.request.newContext({
      baseURL: `${target.protocol}//127.0.0.1:${target.port || "80"}`,
      extraHTTPHeaders: { Host: target.host },
    });
    // oxlint-disable-next-line react-hooks/rules-of-hooks -- Playwright names its fixture continuation `use`; this is not a React Hook.
    await use(request);
    await request.dispose();
  },
});

export { expect, test };
