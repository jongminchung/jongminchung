import { describe, expect, it } from "vitest";
import {
    FIXTURE_REPOSITORY_ACTION_ERROR,
    assertLiveRepositoryActionAllowed,
} from "./fixtureMode";

describe("AssertLiveRepository작업이 허용됨", () => {
    it("[실패] 실제로 거울이 로딩되는 픽스처 세션이 되는 것을 방지함", () => {
        expect(() => assertLiveRepositoryActionAllowed(true)).toThrow(
            FIXTURE_REPOSITORY_ACTION_ERROR,
        );
    });

    it("[성공] 일반 기본 세션에서 이후 관리를 허용함", () => {
        expect(() => assertLiveRepositoryActionAllowed(false)).not.toThrow();
    });
});
