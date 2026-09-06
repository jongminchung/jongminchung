import { expect, test } from "@playwright/test";

for (const [host, paths] of [
  ["jamie.localhost", ["/ko", "/en", "/robots.txt", "/sitemap.xml"]],
  [
    "tech.jamie.localhost",
    [
      "/ko",
      "/en",
      "/ko/rss.xml",
      "/en/search?query=react",
      "/og/en/docs/fe/typescript-6",
    ],
  ],
  ["invest.jamie.localhost", ["/ko", "/en", "/en/rss.xml"]],
] as const) {
  for (const path of paths) {
    test(`${host}${path} 응답이 application 보안 헤더를 제공함`, async ({
      request,
    }) => {
      const response = await request.get(`http://127.0.0.1:3100${path}`, {
        headers: { Host: `${host}:3100` },
      });
      expect(response.status()).toBe(200);
      expect(response.headers()).toMatchObject({
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), geolocation=(), microphone=()",
      });
      expect(response.headers()["x-powered-by"]).toBeUndefined();
    });
  }
}
