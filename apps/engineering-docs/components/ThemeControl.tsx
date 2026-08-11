"use client";

import { Button } from "@jongminchung/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import type { Locale } from "#lib/content-model";
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
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className={"size-9 gap-2 p-0 text-sm"}
            onClick={() => onModeChange(nextMode[mode])}
            type="button"
            variant="ghost"
            size="icon"
          >
            <Icon icon={modeIcon[mode]} />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
