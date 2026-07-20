import { describe, expect, it } from "vitest";
import { REBASED_ACTION_BINDINGS, REBASED_FEATURE_GROUPS, rebasedActionIds } from "./rebasedParity";

describe("Rebased generated action bindings", () => {
  it("maps every candidate command to one source-oracle obligation", () => {
    const ids = rebasedActionIds();
    expect(ids).toHaveLength(243);
    expect(new Set(ids).size).toBe(230);
    expect(new Set(REBASED_ACTION_BINDINGS.map((entry) => entry.commandId)).size).toBe(243);
  });

  it("keeps every binding complete and machine-checkable", () => {
    expect(
      REBASED_ACTION_BINDINGS.every(
        (binding) =>
          binding.sourceId.includes(":") &&
          binding.uiSurface.length > 0 &&
          binding.nativeBoundary.length > 0 &&
          binding.testSurface.length > 0 &&
          binding.visibleWhen.length > 0 &&
          binding.enabledWhen.length > 0,
      ),
    ).toBe(true);
    expect(new Set(Object.values(REBASED_FEATURE_GROUPS).flat())).toEqual(
      new Set(rebasedActionIds()),
    );
  });

  it("does not claim source-wide parity from the candidate subset", () => {
    expect(REBASED_ACTION_BINDINGS).toHaveLength(243);
    expect(
      REBASED_ACTION_BINDINGS.some((binding) => binding.sourceId === "toolwindow:Terminal"),
    ).toBe(true);
  });
});
