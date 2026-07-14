export const iconPalette = Object.freeze({
  deepInk: "#121826",
  cloud: "#F4F6FB",
  cobalt: "#3157D5",
  iris: "#6B5BC7",
  mineralCyan: "#2E98A6",
  humanCoral: "#D96C7B",
});

export const iconVariants = ["personal", "immersive-translate"] as const;
export const iconPreviewSizes = [16, 32, 48, 64, 96, 128, 256] as const;

export type IconVariant = (typeof iconVariants)[number];

interface IconRect {
  readonly fill: string;
  readonly height: number;
  readonly kind: "rect";
  readonly rx: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface IconPath {
  readonly d: string;
  readonly kind: "path";
  readonly stroke: string;
  readonly strokeWidth: number;
}

type IconElement = IconPath | IconRect;

interface IconDefinition {
  readonly elements: readonly IconElement[];
  readonly viewBoxSize: number;
}

const iconDefinitions = Object.freeze({
  personal: {
    viewBoxSize: 64,
    elements: [
      {
        kind: "rect",
        x: 1,
        y: 1,
        width: 62,
        height: 62,
        rx: 14,
        fill: iconPalette.deepInk,
      },
      {
        kind: "path",
        d: "M13 18h17c9 0 16 7 16 16v12",
        stroke: iconPalette.cobalt,
        strokeWidth: 10,
      },
      {
        kind: "path",
        d: "M51 46H34c-9 0-16-7-16-16V18",
        stroke: iconPalette.iris,
        strokeWidth: 10,
      },
      {
        kind: "rect",
        x: 13,
        y: 13,
        width: 10,
        height: 10,
        rx: 2,
        fill: iconPalette.humanCoral,
      },
      {
        kind: "rect",
        x: 41,
        y: 41,
        width: 10,
        height: 10,
        rx: 2,
        fill: iconPalette.mineralCyan,
      },
    ],
  },
  "immersive-translate": {
    viewBoxSize: 128,
    elements: [
      {
        kind: "rect",
        x: 4,
        y: 4,
        width: 120,
        height: 120,
        rx: 27,
        fill: iconPalette.deepInk,
      },
      {
        kind: "path",
        d: "M26 36h42c13 0 24 11 24 24",
        stroke: iconPalette.cobalt,
        strokeWidth: 20,
      },
      {
        kind: "path",
        d: "M102 92H60c-13 0-24-11-24-24",
        stroke: iconPalette.iris,
        strokeWidth: 20,
      },
      {
        kind: "rect",
        x: 26,
        y: 26,
        width: 20,
        height: 20,
        rx: 4,
        fill: iconPalette.cloud,
      },
      {
        kind: "rect",
        x: 82,
        y: 82,
        width: 20,
        height: 20,
        rx: 4,
        fill: iconPalette.mineralCyan,
      },
    ],
  },
} as const satisfies Readonly<Record<IconVariant, IconDefinition>>);

function renderIconElement(element: IconElement): string {
  if (element.kind === "path") {
    return [
      "  <path",
      `    d="${element.d}"`,
      '    fill="none"',
      `    stroke="${element.stroke}"`,
      '    stroke-linecap="square"',
      '    stroke-linejoin="round"',
      `    stroke-width="${element.strokeWidth}"`,
      "  />",
    ].join("\n");
  }

  return `  <rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.rx}" fill="${element.fill}" />`;
}

export function renderIconSvg(variant: IconVariant): string {
  const definition = iconDefinitions[variant];
  const elements = definition.elements.map(renderIconElement).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${definition.viewBoxSize} ${definition.viewBoxSize}">\n${elements}\n</svg>\n`;
}

export function createIconDataUrl(variant: IconVariant): string {
  return `data:image/svg+xml;base64,${btoa(renderIconSvg(variant))}`;
}
