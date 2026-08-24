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

describe("터미널 테마", () => {
  const resolveColor = () => "#123456";

  it("[성공] 의미론적 CSS 의미에서 완전한 ANSI 답변을 정의함", () => {
    const theme = terminalThemeFor(resolveColor);
    for (const color of ANSI_COLORS)
      expect(theme[color]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.cursor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.selectionBackground).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("[성공] 터미널을 열어두어 액세스할 권한만 요청함", () => {
    const requested: string[] = [];
    terminalThemeFor((token) => {
      requested.push(token);
      return "#123456";
    });
    expect(requested).toHaveLength(26);
    expect(requested.every((token) => token.startsWith("--terminal-"))).toBe(
      true,
    );
  });

  it("[성공] xterm 옵션 업데이트를 환영함", () => {
    expect(terminalThemeFor(resolveColor)).not.toBe(
      terminalThemeFor(resolveColor),
    );
  });
});
