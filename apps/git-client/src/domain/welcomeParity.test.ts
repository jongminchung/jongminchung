import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const welcomeRoot = join(appRoot, "parity", "rebased", "1.1.8", "runtime", "welcome");

const scenarios = [
  ["projects", "light-recent"],
  ["customize", "light-focused"],
] as const;

describe("Rebased 1.1.8 Welcome references", () => {
  it.each(scenarios)("pins the %s/%s capture and metadata", (panel, state) => {
    const scenarioRoot = join(welcomeRoot, panel, state);
    const reference = readFileSync(join(scenarioRoot, "reference.png"));
    const metadata = JSON.parse(readFileSync(join(scenarioRoot, "reference.json"), "utf8")) as {
      referenceSha256: string;
      version: string;
      window: { height: number; width: number };
    };

    expect(metadata.version).toBe("1.1.8");
    expect(metadata.window).toEqual({ height: 650, width: 800 });
    expect(createHash("sha256").update(reference).digest("hex")).toBe(metadata.referenceSha256);
  });
});
