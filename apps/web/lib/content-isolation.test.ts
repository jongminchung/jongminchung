import { expect, test } from "bun:test";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dir, "..");

for (const domain of ["tech", "invest"] as const) {
  test(`${domain} 조회는 다른 도메인의 메타데이터 검증 실패에 영향을 받지 않음`, async () => {
    const script =
      domain === "tech"
        ? `
        import { mock } from "bun:test";
        mock.module("./lib/invest/source.ts", () => ({
          readInvestmentNotes() { throw new Error("Invalid Invest metadata"); },
          loadInvestmentContent() { throw new Error("Invalid Invest metadata"); },
        }));
        const { getBlogPosts } = await import("./lib/documents.ts");
        if ((await getBlogPosts()).length === 0) throw new Error("Missing Tech content");
      `
        : `
        import { mock } from "bun:test";
        mock.module("./lib/content-repository.ts", () => ({
          readTechContentSnapshot() { throw new Error("Invalid Tech metadata"); },
        }));
        const { getInvestmentNotes } = await import("./lib/invest/notes.ts");
        if (getInvestmentNotes("en").length === 0) throw new Error("Missing Invest content");
      `;
    const child = Bun.spawn(
      [
        process.execPath,
        "--preload",
        "./scripts/register-content-plugin.ts",
        "--eval",
        script,
      ],
      {
        cwd: webRoot,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [status, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ]);
    expect(stderr).not.toContain("Invalid");
    expect(status).toBe(0);
  });
}
