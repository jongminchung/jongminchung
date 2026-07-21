"use client";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/content-model";
import { DarkThemeIcon, LightThemeIcon, SystemThemeIcon } from "./DocsIcons";
import { Icon, type IconType } from "./Icon";

export type ThemeMode = "light" | "dark" | "system";

const nextMode: Readonly<Record<ThemeMode, ThemeMode>> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const modeIcon: Readonly<Record<ThemeMode, IconType>> = {
  system: SystemThemeIcon,
  light: LightThemeIcon,
  dark: DarkThemeIcon,
};

export function ThemeControl({
  locale,
  mode,
  onModeChange,
}: {
  readonly locale: Locale;
  readonly mode: ThemeMode;
  readonly onModeChange: (mode: ThemeMode) => void;
}) {
  const label = locale === "ko" ? `테마: ${mode}` : `Theme: ${mode}`;
  return (
    <Button
      aria-label={label}
      title={label}
      variant="ghost"
      size="icon"
      onClick={() => onModeChange(nextMode[mode])}
    >
      <Icon icon={modeIcon[mode]} />
    </Button>
  );
}
