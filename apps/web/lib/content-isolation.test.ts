import { afterEach, expect, test, vi } from "vite-plus/test";

afterEach(() => {
  vi.doUnmock("./invest/source.ts");
  vi.doUnmock("./content-repository.ts");
  vi.resetModules();
});

test("tech 조회는 invest 메타데이터 검증 실패에 영향을 받지 않음", async () => {
  vi.doMock("./invest/source.ts", () => ({
    readInvestmentNotes() {
      throw new Error("Invalid Invest metadata");
    },
    loadInvestmentContent() {
      throw new Error("Invalid Invest metadata");
    },
  }));
  const { getBlogPosts } = await import("./documents.ts");
  expect((await getBlogPosts()).length).toBeGreaterThan(0);
});

test("invest 조회는 tech 메타데이터 검증 실패에 영향을 받지 않음", async () => {
  vi.doMock("./content-repository.ts", () => ({
    readTechContentSnapshot() {
      throw new Error("Invalid Tech metadata");
    },
  }));
  const { getInvestmentNotes } = await import("./invest/notes.ts");
  expect(getInvestmentNotes("en").length).toBeGreaterThan(0);
});
