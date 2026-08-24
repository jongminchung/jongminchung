import {
  terminalThemeFor,
  type TerminalColorResolver,
  type TerminalTheme,
} from "../../domain/terminalTheme";

function hexadecimal(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function browserTerminalColorResolver(): TerminalColorResolver {
  const style = getComputedStyle(document.documentElement);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null)
    throw new Error("Terminal theme requires a 2D canvas context");

  return (token): string => {
    const value = style.getPropertyValue(token).trim();
    if (value === "")
      throw new Error(`Terminal theme token is missing: ${token}`);
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const pixels = context.getImageData(0, 0, 1, 1).data;
    const red = pixels[0];
    const green = pixels[1];
    const blue = pixels[2];
    const alpha = pixels[3];
    if (
      red === undefined ||
      green === undefined ||
      blue === undefined ||
      alpha === undefined
    ) {
      throw new Error(`Terminal theme token could not be converted: ${token}`);
    }
    const channels = [red, green, blue, alpha].map(hexadecimal);
    return `#${channels.slice(0, alpha === 255 ? 3 : 4).join("")}`;
  };
}

export function browserTerminalTheme(): TerminalTheme {
  return terminalThemeFor(browserTerminalColorResolver());
}
