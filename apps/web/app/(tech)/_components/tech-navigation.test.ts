// @ts-nocheck
import { describe, expect, it } from "vitest";
import type {
  CurrentNavigationEntry,
  NavigationEntry,
} from "#lib/content-model";
import { documentsForSection, sectionNavigationItems } from "./tech-navigation";

const documents: readonly NavigationEntry[] = [
  {
    id: "overview",
    href: "/en",
    section: "overview",
    title: "Overview",
  },
  {
    id: "ddd",
    href: "/en/articles/ddd",
    section: "handbook",
    title: "DDD",
  },
] as const;

describe("섹션NavigationItems", () => {
  it("[성공] 하나의 현재 문서가 있는 섹션에 대한 개요를 사용함", () => {
    const current: CurrentNavigationEntry = {
      kind: "document",
      id: "ddd",
      href: "/en/articles/ddd",
      title: "DDD",
      section: "handbook",
      outline: [
        { id: "intro", label: "Introduction", level: 2 },
        { id: "detail", label: "Detail", level: 3 },
      ],
    };
    expect(sectionNavigationItems(current, documents)).toEqual([
      {
        id: "intro",
        href: "#intro",
        label: "Introduction",
        selected: false,
      },
    ]);
  });

  it("[성공] 섹션 연결을 선택 취소하고 대체 섹션을 선택하지 않은 상태로 유지함 항목", () => {
    const current: CurrentNavigationEntry = {
      kind: "section",
      id: "handbook",
      href: "/en/series/handbook",
      title: "Handbook",
      section: "handbook",
    };
    expect(sectionNavigationItems(current, documents)[0]).toMatchObject({
      id: "ddd",
      selected: false,
    });
    expect(documentsForSection(documents, "overview")[0]).toMatchObject({
      id: "overview",
      selected: false,
    });
  });
});
