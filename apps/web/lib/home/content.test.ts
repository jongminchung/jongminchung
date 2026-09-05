import { describe, expect, it } from "bun:test";
import { siteOrigins } from "../site-routing";
import { getHomeContent, personSchema } from "./content";

describe("Home 콘텐츠", () => {
  it("Tech·Invest 목적지가 두 언어에서 같은 사이트와 올바른 locale을 가리킴", () => {
    for (const locale of ["ko", "en"] as const) {
      const { destinations } = getHomeContent(locale);
      expect(destinations.map(({ id }) => id)).toEqual(["tech", "invest"]);
      for (const destination of destinations) {
        expect(destination.href).toBe(
          `${siteOrigins[destination.id]}/${locale}`,
        );
        expect(destination.description).not.toBe("");
        expect(destination.action).not.toBe("");
        expect(destination.topics.length).toBeGreaterThan(0);
      }
    }
  });

  it("작업 원칙의 키를 두 언어에서 공유하고 내용을 제공함", () => {
    const english = getHomeContent("en").principles.items;
    const korean = getHomeContent("ko").principles.items;
    expect(english.map(({ key }) => key)).toEqual(korean.map(({ key }) => key));
    expect(new Set(english.map(({ key }) => key)).size).toBe(english.length);
    for (const item of [...english, ...korean]) {
      expect(item.title).not.toBe("");
      expect(item.body).not.toBe("");
    }
  });

  it("표준 프로필 데이터를 제공함", () => {
    expect(personSchema.url).toBe("https://www.jamie.kr");
    expect(personSchema.sameAs).toContain("https://github.com/jongminchung");
    expect(personSchema.knowsAbout).toEqual(
      expect.arrayContaining(["TypeScript", "Developer tooling"]),
    );
  });
});
