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
} as const;

export type TerminalColorResolver = (token: `--terminal-${string}`) => string;
export type TerminalTheme = Readonly<
  Record<keyof typeof TERMINAL_COLOR_TOKENS, string>
>;

export function terminalThemeFor(
  resolveColor: TerminalColorResolver,
): TerminalTheme {
  return Object.fromEntries(
    Object.entries(TERMINAL_COLOR_TOKENS).map(([property, token]) => [
      property,
      resolveColor(token),
    ]),
  ) as TerminalTheme;
}
