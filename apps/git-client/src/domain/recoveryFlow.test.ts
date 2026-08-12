import { describe, expect, it } from "vitest";
import type { HistoryRewritePreview } from "../shared/contracts/model";
import {
    abortOperationConfirmation,
    operationDisplayName,
    protectedRewriteConfirmation,
} from "./recoveryFlow";

describe("recovery flow presentation", () => {
    it("names cherry-pick consistently and describes abort restoration", () => {
        expect(operationDisplayName("cherryPick")).toBe("cherry-pick");
        expect(abortOperationConfirmation("rebase", true)).toMatchObject({
            title: "Abort rebase?",
            confirmLabel: "Abort operation",
            dangerous: true,
            impact: expect.stringContaining("discarded"),
        });
    });

    it("summarizes protected history rewrite impact before execution", () => {
        const preview = {
            branch: "main",
            descendantCount: 3,
            publishedCommitCount: 2,
        } as HistoryRewritePreview;

        expect(protectedRewriteConfirmation(preview)).toMatchObject({
            title: "Rewrite protected branch main?",
            confirmLabel: "Start rebase",
            impact: expect.stringContaining("2 published commit(s)"),
        });
    });
});
