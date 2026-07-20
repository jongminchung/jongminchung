import { describe, expect, it } from "vitest";
import {
  shouldQuitAfterLastWindow,
  shouldRequestProjectClose,
  WELCOME_TRAFFIC_LIGHT_POSITION,
} from "./window-lifecycle";

describe("window lifecycle", () => {
  it("routes a workspace close request back to the renderer", () => {
    expect(shouldRequestProjectClose("workspace", false)).toBe(true);
    expect(shouldRequestProjectClose("welcome", false)).toBe(false);
  });

  it("does not intercept an explicit quit", () => {
    expect(shouldRequestProjectClose("workspace", true)).toBe(false);
  });

  it("keeps a macOS application alive after its last window closes", () => {
    expect(shouldQuitAfterLastWindow("darwin")).toBe(false);
    expect(shouldQuitAfterLastWindow("linux")).toBe(true);
    expect(shouldQuitAfterLastWindow("win32")).toBe(true);
  });

  it("centers macOS traffic lights in the 27px Welcome titlebar", () => {
    expect(WELCOME_TRAFFIC_LIGHT_POSITION).toEqual({ x: 14, y: 7 });
  });
});
