import { describe, expect, it } from "bun:test";
import { getTechMessages } from "./copy";

describe("Tech typed copy", () => {
  it("locale별 접근성 문구를 반환함", () => {
    expect(getTechMessages("ko").docs.breadcrumb).toBe("현재 위치");
    expect(getTechMessages("en").docs.breadcrumb).toBe("Breadcrumb");
    expect(getTechMessages("ko").shell.navigation).not.toBe(
      getTechMessages("en").shell.navigation,
    );
  });
});
