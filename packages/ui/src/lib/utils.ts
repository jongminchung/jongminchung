import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** `cn` 공개 기능을 제공함 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
