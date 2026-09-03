import { describe, expect, it } from "bun:test";
import { documentKindLabel } from "./document-kind";

describe("Diátaxis 문서 유형 label", () => {
  it("[성공] UI 전체에서 사용할 canonical label을 반환함", () => {
    expect(documentKindLabel("ko", "reference")).toBe("기술 참조");
    expect(documentKindLabel("en", "how-to")).toBe("How-to guide");
  });
});
