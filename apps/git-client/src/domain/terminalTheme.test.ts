import { describe, expect, it } from "vitest";
import { terminalThemeFor } from "./terminalTheme";

const ANSI_COLORS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
] as const;

describe("terminal themes", () => {
  it.each(["light", "dark"] as const)("defines a complete %s ANSI palette", (scheme) => {
    const theme = terminalThemeFor(scheme);
    for (const color of ANSI_COLORS) expect(theme[color]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.cursor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.selectionBackground).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("keeps light and dark terminal surfaces visually distinct", () => {
    const light = terminalThemeFor("light");
    const dark = terminalThemeFor("dark");
    expect(light.background).not.toBe(dark.background);
    expect(light.foreground).not.toBe(dark.foreground);
    expect(light.cursor).not.toBe(dark.cursor);
    expect(light.selectionBackground).not.toBe(dark.selectionBackground);
  });

  it("returns a fresh theme object for xterm option updates", () => {
    expect(terminalThemeFor("dark")).not.toBe(terminalThemeFor("dark"));
  });
});
