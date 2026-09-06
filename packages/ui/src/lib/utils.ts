import { clsx, type ClassValue } from "clsx";
import {
  createTailwindMerge,
  getDefaultConfig,
  type Config,
  type DefaultClassGroupIds,
  type DefaultThemeGroupIds,
} from "tailwind-merge";

// 사용자 정의 글자 크기를 text-color로 해석하지 않도록 토큰 역할을 등록함.
const twMerge = createTailwindMerge(() => {
  const config: Config<DefaultClassGroupIds, DefaultThemeGroupIds> =
    getDefaultConfig();
  config.theme.tracking = [...config.theme.tracking, "metadata"];
  config.classGroups["font-size"] = [
    ...config.classGroups["font-size"],
    { text: ["metadata", "caption"] },
  ];
  return config;
});

// UI component는 package self-reference를 사용해 workspace source와 배포 dist에서 같은 공개 subpath를 유지함
/** 조건부 클래스를 합친 뒤 Tailwind 충돌을 정리해 소비자의 스타일 재정의를 지원함. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
