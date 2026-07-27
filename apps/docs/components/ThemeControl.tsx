"use client";

import { Button } from "@base-ui/react/button";
import type { Locale } from "@/lib/content-model";
import { cn } from "@/lib/utils";
import { DarkThemeIcon, LightThemeIcon, SystemThemeIcon } from "./DocsIcons";
import { Icon, type IconType } from "./Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

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
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-transparent p-0 text-sm font-medium outline-none transition-colors",
              "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
            )}
            data-slot="button"
            onClick={() => onModeChange(nextMode[mode])}
            type="button"
          >
            <Icon icon={modeIcon[mode]} />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
