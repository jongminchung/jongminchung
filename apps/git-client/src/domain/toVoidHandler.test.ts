import { afterEach, describe, expect, it, vi } from "vitest";
import { runInBackground, toVoidHandler } from "./toVoidHandler";

describe("toVoidHandler", () => {
    afterEach(() => vi.restoreAllMocks());

    it("[성공] 듀얼 이벤트 처리기 계약을 유지하면서 인수를 전달함", async () => {
        const handler = vi.fn(async (value: string): Promise<void> => {
            await Promise.resolve();
            expect(value).toBe("value");
        });
        const eventHandler = toVoidHandler(handler);

        expect(eventHandler("value")).toBeUndefined();
        await vi.waitFor(() => expect(handler).toHaveBeenCalledWith("value"));
    });

    it("[성공] [패] 처리되지 않은 존재를 생성하지 않은 배경실을 보고함", async () => {
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
