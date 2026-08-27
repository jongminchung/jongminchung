import { describe, expect, it } from "vitest";
import { messagesFor } from "./i18n-messages.ts";

function leafPaths(value: unknown, prefix = ""): readonly string[] {
  if (typeof value !== "object" || value === null)
    return prefix === "" ? [] : [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    leafPaths(nested, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("UI message catalog", () => {
  it("[성공] 한국어와 영어가 같은 메시지 키를 제공함", () => {
    expect(leafPaths(messagesFor("ko")).toSorted()).toEqual(
      leafPaths(messagesFor("en")).toSorted(),
    );
  });
});
