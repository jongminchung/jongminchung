import { deflateRawSync } from "node:zlib";

export function createPlantUmlSvgUrl(source: string, serverBaseUrl: string): string {
  return `${normalizePlantUmlServerBaseUrl(serverBaseUrl)}/${encodePlantUmlSource(source)}`;
}

export function encodePlantUmlSource(source: string): string {
  return encodePlantUmlBytes(deflateRawSync(Buffer.from(source, "utf8")));
}

export function normalizePlantUmlServerBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("PlantUML serverBaseUrl is required");
  return trimmed.replace(/\/+$/u, "");
}

function encodePlantUmlBytes(bytes: Buffer): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const chunk = append3Bytes(first, second, third);

    if (index + 1 >= bytes.length) encoded += chunk.slice(0, 2);
    else if (index + 2 >= bytes.length) encoded += chunk.slice(0, 3);
    else encoded += chunk;
  }
  return encoded;
}

function append3Bytes(first: number, second: number, third: number): string {
  const c1 = first >> 2;
  const c2 = ((first & 0x3) << 4) | (second >> 4);
  const c3 = ((second & 0xf) << 2) | (third >> 6);
  const c4 = third & 0x3f;
  return `${encode6Bit(c1)}${encode6Bit(c2)}${encode6Bit(c3)}${encode6Bit(c4)}`;
}

function encode6Bit(value: number): string {
  if (value < 10) return String.fromCharCode(48 + value);
  if (value < 36) return String.fromCharCode(65 + value - 10);
  if (value < 62) return String.fromCharCode(97 + value - 36);
  if (value === 62) return "-";
  if (value === 63) return "_";
  throw new Error(`Invalid PlantUML 6-bit value: ${value}`);
}
