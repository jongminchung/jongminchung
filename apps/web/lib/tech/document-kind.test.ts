import { describe, expect, it } from "bun:test";
import { documentKindLabel, isDocumentKind } from "./document-kind";

describe("Diátaxis 문서 유형 label", () => {
  it("[성공] UI 전체에서 사용할 canonical label을 반환함", () => {
    expect(documentKindLabel("ko", "reference")).toBe("기술 참조");
    expect(documentKindLabel("en", "how-to")).toBe("How-to guide");
  });

  it("[실패] 알 수 없는 값과 객체 속성 이름을 문서 유형으로 허용하지 않음", () => {
    for (const value of [
      undefined,
      null,
      1,
      {},
      "",
      "Docs",
      "toString",
      "__proto__",
    ]) {
      expect(isDocumentKind(value)).toBe(false);
    }
    expect(isDocumentKind("reference")).toBe(true);
  });
});
