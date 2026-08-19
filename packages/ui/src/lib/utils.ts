import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// UI component는 package self-reference를 사용해 workspace source와 배포 dist에서 같은 공개 subpath를 유지함
/** `cn` 공개 기능을 제공함 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
