import { afterEach, describe, expect, it, vi } from "vitest";
import { runInBackground, toVoidHandler } from "./toVoidHandler";

describe("toVoidHandler", () => {
    afterEach(() => vi.restoreAllMocks());

    it("forwards arguments while keeping a void event-handler contract", async () => {
        const handler = vi.fn(async (value: string): Promise<void> => {
            await Promise.resolve();
            expect(value).toBe("value");
        });
        const eventHandler = toVoidHandler(handler);

        expect(eventHandler("value")).toBeUndefined();
        await vi.waitFor(() => expect(handler).toHaveBeenCalledWith("value"));
    });

    it("reports rejected background work without creating an unhandled rejection", async () => {
        const error = new Error("disk unavailable");
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);

        runInBackground(Promise.reject(error), "Settings persistence");

        await vi.waitFor(() =>
            expect(consoleError).toHaveBeenCalledWith(
                "Settings persistence failed",
                error,
            ),
        );
    });
});
