"use client";

import { Button } from "@astryxdesign/core/Button";
import { Icon, type IconType } from "@astryxdesign/core/Icon";
import type { ThemeMode } from "@astryxdesign/core/theme";
import type { Locale } from "@/lib/content-model";
import { DarkThemeIcon, LightThemeIcon, SystemThemeIcon } from "./DocsIcons";

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
      label={label}
      tooltip={label}
      icon={<Icon icon={modeIcon[mode]} size="sm" />}
      isIconOnly
      variant="ghost"
      size="sm"
      onClick={() => onModeChange(nextMode[mode])}
    />
  );
}
