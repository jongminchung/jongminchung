const states = new Map<string, number>();

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function resetMaterialSeed(id: string): void {
  states.set(id, hash(id) || 1);
}

export function seededMaterialRandom(id: string): number {
  let state = states.get(id) ?? (hash(id) || 1);
  state += 0x6d2b79f5;
  states.set(id, state >>> 0);
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
