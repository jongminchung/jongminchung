import type { SetStateAction } from "react";

export function resolveRepositoryState<T>(
    value: SetStateAction<T>,
    current: T,
): T {
    return typeof value === "function"
        ? (value as (previous: T) => T)(current)
        : value;
}
