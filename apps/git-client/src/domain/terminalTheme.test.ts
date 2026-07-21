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
  const resolveColor = () => "#123456";

  it("defines a complete ANSI palette from semantic CSS tokens", () => {
    const theme = terminalThemeFor(resolveColor);
    for (const color of ANSI_COLORS) expect(theme[color]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.cursor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.selectionBackground).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("requests only terminal-prefixed tokens", () => {
    const requested: string[] = [];
    terminalThemeFor((token) => {
      requested.push(token);
      return "#123456";
    });
    expect(requested).toHaveLength(26);
    expect(requested.every((token) => token.startsWith("--terminal-"))).toBe(true);
  });

  it("returns a fresh theme object for xterm option updates", () => {
    expect(terminalThemeFor(resolveColor)).not.toBe(terminalThemeFor(resolveColor));
  });
});
