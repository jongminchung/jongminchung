import { describe, expect, it } from "bun:test";
import { cn } from "./lib/utils";

describe("semantic Tailwind utility 병합", () => {
  it.each(["metadata", "caption"])(
    "%s 크기가 색상과 공존하며 기존 크기를 재정의함",
    (size) => {
      expect(cn("text-sm text-foreground", `text-${size}`)).toBe(
        `text-foreground text-${size}`,
      );
      expect(cn(`text-${size} text-foreground`, "text-base")).toBe(
        "text-foreground text-base",
      );
      expect(cn(`text-${size} text-foreground`, "text-muted-foreground")).toBe(
        `text-${size} text-muted-foreground`,
      );
    },
  );
  it("토큰 간 충돌을 정리하고 breakpoint·상태를 구분함", () => {
    expect(cn("text-metadata", "text-caption")).toBe("text-caption");
    expect(cn("tracking-wide", "tracking-metadata")).toBe("tracking-metadata");
    expect(
      cn(
        "text-metadata hover:text-foreground sm:text-caption",
        "text-base sm:text-lg",
      ),
    ).toBe("hover:text-foreground text-base sm:text-lg");
  });
});
