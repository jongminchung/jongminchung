import { describe, expect, it } from "vitest";
import {
    DESKTOP_STREAM_PROTOCOL_VERSION,
    DesktopStreamConnectSchema,
    DesktopStreamEnvelopeSchema,
} from "./desktop-stream";

describe("desktop stream contract", () => {
    it("accepts the current handshake and rejects version skew", () => {
        expect(
            DesktopStreamConnectSchema.parse({
                version: DESKTOP_STREAM_PROTOCOL_VERSION,
            }),
        ).toEqual({
            version: 1,
        });
        expect(() =>
            DesktopStreamConnectSchema.parse({ version: 2 }),
        ).toThrow();
    });

    it("accepts a typed Git barrier and rejects extra fields", () => {
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
