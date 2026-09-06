import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// UI component는 package self-reference를 사용해 workspace source와 배포 dist에서 같은 공개 subpath를 유지함
/** 조건부 클래스를 합친 뒤 Tailwind 충돌을 정리해 소비자의 스타일 재정의를 지원함. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
