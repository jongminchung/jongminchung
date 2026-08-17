import { describe, expect, it } from "vitest";
import { stateMachineTransitions } from "./StateMachineModel";

describe("stateMachineTransitions", () => {
    it("models one complete add-to-cart cycle", () => {
        expect(stateMachineTransitions.idle).toMatchObject({
            edge: "CLICK",
            next: "loading",
            delay: 1700,
        });
        expect(stateMachineTransitions.loading).toMatchObject({
            edge: "SUCCESS",
            next: "added",
            delay: 1300,
        });
        expect(stateMachineTransitions.added).toMatchObject({
            edge: "RESET",
            next: "idle",
            delay: 1900,
        });
    });
});
