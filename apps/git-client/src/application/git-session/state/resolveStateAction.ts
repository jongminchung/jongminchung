export type StateAction<T> = T | ((current: T) => T);

export function resolveStateAction<T>(value: StateAction<T>, current: T): T {
  return typeof value === "function"
    ? (value as (previous: T) => T)(current)
    : value;
}
