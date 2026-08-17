import { describe, expect, it } from "vitest";
import { stateMachineTransitions } from "./StateMachineModel";

describe("상태머신전환", () => {
    it("[성공] 하나의 완전한 캐리어 추가 장식함", () => {
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
