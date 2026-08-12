import { describe, expect, it } from "vitest";
import {
    FIXTURE_REPOSITORY_ACTION_ERROR,
    assertLiveRepositoryActionAllowed,
} from "./fixtureMode";

describe("assertLiveRepositoryActionAllowed", () => {
    it("prevents a real repository from becoming a permanently loading fixture session", () => {
        expect(() => assertLiveRepositoryActionAllowed(true)).toThrow(
            FIXTURE_REPOSITORY_ACTION_ERROR,
        );
    });

    it("allows repository management in a normal native session", () => {
        expect(() => assertLiveRepositoryActionAllowed(false)).not.toThrow();
    });
});
