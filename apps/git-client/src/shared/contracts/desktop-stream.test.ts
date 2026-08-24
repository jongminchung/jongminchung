import { describe, expect, it } from "vitest";
import {
  DESKTOP_STREAM_PROTOCOL_VERSION,
  DesktopStreamConnectSchema,
  DesktopStreamEnvelopeSchema,
} from "./desktop-stream";

describe("카트리지 연결", () => {
  it("[실패] 현재 핸드셰이크를 마이킹하고 버전을 수정하고 있음", () => {
    expect(
      DesktopStreamConnectSchema.parse({
        version: DESKTOP_STREAM_PROTOCOL_VERSION,
      }),
    ).toEqual({
      version: 1,
    });
    expect(() => DesktopStreamConnectSchema.parse({ version: 2 })).toThrow();
  });

  it("[실패] 입력된 Git 허용을 허용하고 추가 필드를 유지함", () => {
    const barrier = {
      kind: "git.barrier" as const,
      operation: "query" as const,
      requestId: "388ac97b-6f01-4e10-8149-78ec15412d18",
    };
    expect(DesktopStreamEnvelopeSchema.parse(barrier)).toEqual(barrier);
    expect(() =>
      DesktopStreamEnvelopeSchema.parse({
        ...barrier,
        channel: "legacy",
      }),
    ).toThrow();
  });
});
