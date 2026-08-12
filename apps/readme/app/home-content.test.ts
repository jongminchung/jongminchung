import { describe, expect, it } from "vitest";
import { personSchema, principles, projects } from "./home-content";

describe("README home content", () => {
    it("keeps project indices, destinations, and tags complete and unique", () => {
        expect(projects).toHaveLength(2);
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

    it("keeps the three named working principles unique and complete", () => {
        expect(principles).toHaveLength(3);
        expect(new Set(principles.map((principle) => principle.key)).size).toBe(
            principles.length,
        );
        for (const principle of principles) {
            expect(principle.title).not.toBe("");
            expect(principle.body).not.toBe("");
        }
    });

    it("publishes canonical person discovery data", () => {
        expect(personSchema.url).toBe("https://jamie.kr");
        expect(personSchema.sameAs).toContain(
            "https://github.com/jongminchung",
        );
        expect(personSchema.knowsAbout).toEqual(
            expect.arrayContaining(["TypeScript", "Developer tooling"]),
        );
    });
});
