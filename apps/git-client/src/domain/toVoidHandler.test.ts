import { describe, expect, it, vi } from "vitest";
import { toVoidHandler } from "./toVoidHandler";

describe("toVoidHandler", () => {
    it("forwards arguments while keeping a void event-handler contract", async () => {
        const handler = vi.fn(async (value: string): Promise<void> => {
            await Promise.resolve();
            expect(value).toBe("value");
        });
        const eventHandler = toVoidHandler(handler);

        expect(eventHandler("value")).toBeUndefined();
        await vi.waitFor(() => expect(handler).toHaveBeenCalledWith("value"));
    });
});
