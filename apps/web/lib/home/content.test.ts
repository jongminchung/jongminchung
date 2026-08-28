import { describe, expect, it } from "vitest";
import { getHomeContent, personSchema } from "./content";

describe("읽어보기 홈 콘텐츠", () => {
  it("[성공] 프로젝트 색상, 대상 및 태그를 완전하고 고유하게 유지함", () => {
    const { projects } = getHomeContent("en");
    expect(new Set(projects.map((project) => project.index)).size).toBe(
      projects.length,
    );
    expect(new Set(projects.map((project) => project.href)).size).toBe(
      projects.length,
    );
    for (const project of projects) {
      expect(project.href).toMatch(/^https:\/\//u);
      expect(project.tags.length).toBeGreaterThan(0);
      expect(project.description).not.toBe("");
    }
  });

  it("[성공] 작업 원칙을 공유하고 완전하게 유지함", () => {
    const { principles } = getHomeContent("en");
    expect(new Set(principles.map((principle) => principle.key)).size).toBe(
      principles.length,
    );
    for (const principle of principles) {
      expect(principle.title).not.toBe("");
      expect(principle.body).not.toBe("");
    }
  });

  it("[성공] 표준 서비스 데이터 게시", () => {
    expect(personSchema.url).toBe("https://www.jamie.kr");
    expect(personSchema.sameAs).toContain("https://github.com/jongminchung");
    expect(personSchema.knowsAbout).toEqual(
      expect.arrayContaining(["TypeScript", "Developer tooling"]),
    );
  });
});
