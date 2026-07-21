import type { ITheme } from "@xterm/xterm";

const TERMINAL_COLOR_TOKENS = {
  background: "--terminal-background",
  foreground: "--terminal-foreground",
  cursor: "--terminal-cursor",
  cursorAccent: "--terminal-cursor-accent",
  selectionBackground: "--terminal-selection-background",
  selectionForeground: "--terminal-selection-foreground",
  selectionInactiveBackground: "--terminal-selection-inactive-background",
  scrollbarSliderBackground: "--terminal-scrollbar",
  scrollbarSliderHoverBackground: "--terminal-scrollbar-hover",
  scrollbarSliderActiveBackground: "--terminal-scrollbar-active",
  black: "--terminal-black",
  red: "--terminal-red",
  green: "--terminal-green",
  yellow: "--terminal-yellow",
  blue: "--terminal-blue",
  magenta: "--terminal-magenta",
  cyan: "--terminal-cyan",
  white: "--terminal-white",
  brightBlack: "--terminal-bright-black",
  brightRed: "--terminal-bright-red",
  brightGreen: "--terminal-bright-green",
  brightYellow: "--terminal-bright-yellow",
  brightBlue: "--terminal-bright-blue",
  brightMagenta: "--terminal-bright-magenta",
  brightCyan: "--terminal-bright-cyan",
  brightWhite: "--terminal-bright-white",
} as const satisfies Readonly<Partial<Record<keyof ITheme, `--terminal-${string}`>>>;

export type TerminalColorResolver = (token: `--terminal-${string}`) => string;

function hexadecimal(value: number): string {
  return value.toString(16).padStart(2, "0");
}

export function browserTerminalColorResolver(): TerminalColorResolver {
  const style = getComputedStyle(document.documentElement);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) throw new Error("Terminal theme requires a 2D canvas context");

  return (token): string => {
    const value = style.getPropertyValue(token).trim();
    if (value === "") throw new Error(`Terminal theme token is missing: ${token}`);
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const pixels = context.getImageData(0, 0, 1, 1).data;
    const red = pixels[0];
    const green = pixels[1];
    const blue = pixels[2];
    const alpha = pixels[3];
    if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
      throw new Error(`Terminal theme token could not be converted: ${token}`);
    }
    const channels = [red, green, blue, alpha].map(hexadecimal);
    return `#${channels.slice(0, alpha === 255 ? 3 : 4).join("")}`;
  };
}

export function terminalThemeFor(resolveColor = browserTerminalColorResolver()): ITheme {
  return Object.fromEntries(
    Object.entries(TERMINAL_COLOR_TOKENS).map(([property, token]) => [
      property,
      resolveColor(token),
    ]),
  );
}
